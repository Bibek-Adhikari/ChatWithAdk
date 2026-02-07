
const WORLD_NEWS_KEY = import.meta.env.VITE_WORLD_NEWS_API_KEY || "52baf80a5b2d43feb817cf585def1cc1";
const NEWSDATA_KEY = import.meta.env.VITE_NEWSDATA_API_KEY || "pub_11299103b1234c4ab2663e91ce5f4cba";

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
    
    // Fetch in parallel across all generated queries
    const allTasks = subjectQueries.flatMap(q => [
      fetch(`https://api.worldnewsapi.com/search-news?api-key=${WORLD_NEWS_KEY}&text=${encodeURIComponent(q)}&number=10&language=en&sort=publish-time&sort-direction=DESC`)
        .then(r => r.ok ? r.json() : { news: [] })
        .then(data => data.news || [])
        .catch(() => []),
      fetch(`https://newsdata.io/api/1/latest?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(q)}&language=en&size=10${isPolitical ? '&category=politics' : ''}`)
        .then(r => r.ok ? r.json() : { results: [] })
        .then(data => data.results || [])
        .catch(() => [])
    ]);

    const results = await Promise.all(allTasks);
    const combined = results.flat();

    const normalized = combined.map((n: any) => ({
      title: n.title || '',
      text: cleanAndTruncate(`${n.title}. ${n.text || n.summary || n.content || n.description || ''}`, 4000),
      url: n.url || n.link || '',
      publish_date: n.publish_date || n.pubDate || ''
    }));

    // RELEVANCE SCORING: Avoid generic listicles like "UPSC Current Affairs" if possible
    const scored = normalized.map(a => {
      const content = (a.title + ' ' + a.text).toLowerCase();
      let score = 0;
      
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
