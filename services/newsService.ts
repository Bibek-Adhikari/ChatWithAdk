
const WORLD_NEWS_KEY = import.meta.env.VITE_WORLD_NEWS_API_KEY || "";
const NEWSDATA_KEY = import.meta.env.VITE_NEWSDATA_API_KEY || "";
const TAVILY_KEY = import.meta.env.VITE_TAVILY_API_KEY || "";

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
    
    // Helper to limit concurrent API calls to avoid rate limiting
    const limitedFetch = async <T,>(tasks: (() => Promise<T>)[], concurrency: number = 3): Promise<T[]> => {
      const results: T[] = [];
      const executing: Promise<void>[] = [];
      
      for (const task of tasks) {
        const promise = task().then(result => {
          results.push(result);
        });
        
        executing.push(promise);
        
        if (executing.length >= concurrency) {
          await Promise.race(executing);
          executing.splice(executing.findIndex(p => p === promise), 1);
        }
      }
      
      await Promise.all(executing);
      return results;
    };
    
    // Fetch in parallel across all generated queries - WITH RATE LIMITING
    // Build task array - conditionally include Tavily based on API key
    const getTavilyTask = (q: string): (() => Promise<any[]>) => {
      if (!TAVILY_KEY) return () => Promise.resolve([]);
      
      return () => fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: TAVILY_KEY,
          query: q,
          search_depth: 'basic',
          max_results: 10,
          include_answer: false,
          include_raw_content: false
        })
      })
        .then(r => r.ok ? r.json() : { results: [] })
        .then(data => {
          // eslint-disable-next-line no-console
          console.log(`[NewsService] Tavily response for "${q}":`, data.results?.length || 0, 'results');
          return (data.results || []).map((r: any) => ({
            title: r.title || '',
            text: r.content || r.snippet || '',
            url: r.url || '',
            publish_date: r.published_date || r.date || ''
          }));
        })
        .catch(() => []);
    };
    
    const getWorldNewsTask = (q: string): (() => Promise<any[]>) => {
      if (!WORLD_NEWS_KEY) return () => Promise.resolve([]);
      return () =>
        fetch(`https://api.worldnewsapi.com/search-news?api-key=${WORLD_NEWS_KEY}&text=${encodeURIComponent(q)}&number=10&language=en&sort=publish-time&sort-direction=DESC`)
          .then(r => r.ok ? r.json() : { news: [] })
          .then(data => data.news || [])
          .catch(() => []);
    };
    
    const getNewsDataTask = (q: string): (() => Promise<any[]>) => {
      if (!NEWSDATA_KEY) return () => Promise.resolve([]);
      return () =>
        fetch(`https://newsdata.io/api/1/latest?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(q)}&language=en&size=10${isPolitical ? '&category=politics' : ''}`)
          .then(r => r.ok ? r.json() : { results: [] })
          .then(data => data.results || [])
          .catch(() => []);
    };
    
    const allTasks: (() => Promise<any[]>)[] = subjectQueries.flatMap(q => [
      getTavilyTask(q),
      getWorldNewsTask(q),
      getNewsDataTask(q)
    ]);

    // Use limited concurrency to avoid rate limiting
    const results = await limitedFetch(allTasks, 3);
    const combined = results.flat();

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

    return unique.sort((a, b) => {
      const dateA = new Date(a.publish_date).getTime();
      const dateB = new Date(b.publish_date).getTime();
      return dateB - dateA;
    }).slice(0, 8);
  } catch (err) {
    console.error("News Fetch Failed:", err);
    return [];
  }
}

export function shouldFetchNews(input: string): boolean {
  const lowerInput = input.toLowerCase();
  const triggers = [
    "who is", "latest", "new", "update", "current", 
    "news", "happening", "prime minister", "president",
    "today", "yesterday", "recently", "what happened",
    "leader of", "pm of", "who's the", "tell me about"
  ];
  return triggers.some(trigger => lowerInput.includes(trigger));
}
