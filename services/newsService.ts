
import { proxyPost } from './serverProxy';

const WORLD_NEWS_KEY = import.meta.env.VITE_WORLD_NEWS_API_KEY || "";
const NEWSDATA_KEY = import.meta.env.VITE_NEWSDATA_API_KEY || "";
const TAVILY_KEY = import.meta.env.VITE_TAVILY_API_KEY || "";

// Client-side news cache + cascade threshold (credit savers: repeats cost zero)
const CLIENT_NEWS_TTL_MS = 15 * 60 * 1000;
const clientNewsCache = new Map<string, { at: number; articles: NewsArticle[] }>();
const MIN_DIRECT_ARTICLES = 3;

// Warn if Tavily API key is not configured
if (!TAVILY_KEY) {
  console.warn('[NewsService] Tavily API key not configured. Set VITE_TAVILY_API_KEY in .env');
}
if (!WORLD_NEWS_KEY) {
  console.warn('[NewsService] World News API key not configured. Set VITE_WORLD_NEWS_API_KEY in .env');
}
if (!NEWSDATA_KEY) {
  console.warn('[NewsService] NewsData API key not configured. Set VITE_NEWSDATA_API_KEY in .env');
}

export interface NewsArticle {
  title: string;
  text: string;
  url: string;
  publish_date: string;
}

function cleanAndTruncate(text: string, maxLen: number = 4000): string {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.substring(0, maxLen) + '...' : cleaned;
}

export async function fetchLatestNews(input: string): Promise<NewsArticle[]> {
  const lowerInput = input.toLowerCase();
  
  // Clean query
  let cleanerQuery = lowerInput
    .replace(/who is the/g, '')
    .replace(/who is/g, '')
    .replace(/what is the/g, '')
    .replace(/what is/g, '')
    .replace(/latest news on/g, '')
    .replace(/tell me about/g, '')
    .replace(/who's the/g, '')
    .trim();

  // HEURISTIC: Generate high-likelihood queries for identity extraction
  const subjectQueries = [];
  if (lowerInput.includes('nepal') && (lowerInput.includes('pm') || lowerInput.includes('prime minister'))) {
    subjectQueries.push('Nepal "Prime Minister" current');
    subjectQueries.push('who is the current prime minister of Nepal 2025 2026');
    subjectQueries.push('Nepal Prime Minister sworn in');
  } else {
    subjectQueries.push(cleanerQuery);
    if (lowerInput.includes('who')) subjectQueries.push(`${cleanerQuery} bio biography current`);
  }

  console.log(`[NewsService] Triple-Fetch Strategy: ${subjectQueries.join(' | ')}`);

  try {
    const isPolitical = lowerInput.includes('prime minister') || lowerInput.includes('president') || lowerInput.includes('leader') || lowerInput.includes('pm') || lowerInput.includes('nepal');

    // Client cache: identical questions within 15 min cost zero, even in direct-key mode
    const clientCacheKey = subjectQueries[0].toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
    const clientHit = clientNewsCache.get(clientCacheKey);
    if (clientHit && Date.now() - clientHit.at < CLIENT_NEWS_TTL_MS) {
      console.log('[NewsService] client cache hit');
      return clientHit.articles;
    }
    
    // Direct-provider cascade (credit saver): Tavily → WorldNews → NewsData on a
    // SINGLE query, stopping at the first provider with >= 3 articles.
    // Typical cost: 1 paid call per question instead of ~9.
    const singleQuery = subjectQueries[0];
    const fetchTavilyDirect = async (): Promise<any[]> => {
      if (!TAVILY_KEY) return [];

      return fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_KEY,
          query: singleQuery,
          search_depth: 'basic',
          max_results: 5,
          include_answer: false,
          include_raw_content: false
        })
      })
        .then(r => r.ok ? r.json() : { results: [] })
        .then(data => {
          // eslint-disable-next-line no-console
          console.log(`[NewsService] Tavily response for "${singleQuery}":`, data.results?.length || 0, 'results');
          return (data.results || []).map((r: any) => ({
            title: r.title || '',
            text: r.content || r.snippet || '',
            url: r.url || '',
            publish_date: r.published_date || r.date || ''
          }));
        })
        .catch(() => []);
    };

    const fetchWorldNewsDirect = async (): Promise<any[]> => {
      if (!WORLD_NEWS_KEY) return [];
      return fetch(`https://api.worldnewsapi.com/search-news?api-key=${WORLD_NEWS_KEY}&text=${encodeURIComponent(singleQuery)}&number=5&language=en&sort=publish-time&sort-direction=DESC`)
        .then(r => r.ok ? r.json() : { news: [] })
        .then(data => data.news || [])
        .catch(() => []);
    };

    const fetchNewsDataDirect = async (): Promise<any[]> => {
      if (!NEWSDATA_KEY) return [];
      return fetch(`https://newsdata.io/api/1/latest?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(singleQuery)}&language=en&size=5${isPolitical ? '&category=politics' : ''}`)
        .then(r => r.ok ? r.json() : { results: [] })
        .then(data => data.results || [])
        .catch(() => []);
    };

    // Prefer the metered server proxy (per-user daily quota, keys stay
    // server-side, cascade + cache). Falls back to the direct cascade below.
    let combined: any[] | null = null;
    const proxyRes = await proxyPost<{ articles: any[] }>('/news', { q: singleQuery, political: isPolitical }).catch(() => null);
    if (proxyRes && proxyRes.status === 429) {
      console.warn('[NewsService] Server news quota reached for today.');
      return [];
    }
    if (proxyRes && proxyRes.status === 200 && Array.isArray(proxyRes.json?.articles)) {
      combined = proxyRes.json.articles;
    }
    if (!combined) {
      // Direct-provider cascade: stop at the first provider with enough articles
      combined = await fetchTavilyDirect();
      if (combined.length < MIN_DIRECT_ARTICLES) combined = combined.concat(await fetchWorldNewsDirect());
      if (combined.length < MIN_DIRECT_ARTICLES) combined = combined.concat(await fetchNewsDataDirect());
    }

    const normalized = combined.map((n: any) => ({
      title: n.title || '',
      text: cleanAndTruncate(`${n.title}. ${n.text || n.summary || n.content || n.description || ''}`, 4000),
      url: n.url || n.link || '',
      publish_date: n.publish_date || n.pubDate || ''
    }));

    // RELEVANCE SCORING: Prioritize Tavily results (more up-to-date) then avoid generic listicles like "UPSC Current Affairs" if possible
    const scored = normalized.map(a => {
      const content = (a.title + ' ' + a.text).toLowerCase();
      let score = 0;
      
      // TAVILY BOOST: Give higher priority to Tavily results (they tend to be more current)
      // Check if content looks recent (Tavily provides more real-time data)
      const currentYear = new Date().getFullYear();
      const hasCurrentYear = content.includes(currentYear.toString()) || content.includes((currentYear - 1).toString());
      if (hasCurrentYear) score += 5;
      
      // Core subject match
      if (lowerInput.includes('nepal')) {
        if (content.includes('nepal')) score += 10;
        if (content.includes('prime minister') || content.includes('premier') || content.includes('pm')) score += 10;
        // Search for likely names (KP Sharma Oli is the current real-world PM)
        if (content.includes('oli') || content.includes('dahal') || content.includes('deuba')) score += 5;
      }
      
      // Filter out generic educational "UPSC" noise
      if (content.includes('upsc') || content.includes('quiz') || content.includes('current affairs pdf')) score -= 15;
      
      return { article: a, score };
    });

    // Only keep decent scores
    const relevant = scored
      .filter(s => s.score > 5)
      .map(s => s.article);

    // If scoring wiped it out, revert to simple filter but limit noise
    const finalPool = relevant.length > 0 ? relevant : normalized.filter(a => {
      const content = (a.title + ' ' + a.text).toLowerCase();
      if (lowerInput.includes('nepal')) return content.includes('nepal') && (content.includes('prime minister') || content.includes('pm'));
      return true;
    });

    const seen = new Set();
    const unique = finalPool.filter(a => {
      const title = a.title.toLowerCase().trim();
      if (seen.has(title)) return false;
      seen.add(title);
      return true;
    });

    const finalArticles = unique.sort((a, b) => {
      const dateA = new Date(a.publish_date).getTime();
      const dateB = new Date(b.publish_date).getTime();
      return dateB - dateA;
    }).slice(0, 8);
    if (clientNewsCache.size > 200) clientNewsCache.clear();
    clientNewsCache.set(clientCacheKey, { at: Date.now(), articles: finalArticles });
    return finalArticles;
  } catch (err) {
    console.error("News Fetch Failed:", err);
    return [];
  }
}

export function shouldFetchNews(input: string): boolean {
  const lowerInput = input.toLowerCase();
  const triggers = [
    "who is", "latest", "current",
    "news", "happening", "prime minister", "president",
    "today", "yesterday", "recently", "what happened",
    "leader of", "pm of", "who's the"
  ];
  return triggers.some(trigger => lowerInput.includes(trigger));
}
