export interface NormalizedArticle {
  url: string;
  title: string;
  source: string;
  publishedAt: Date;
}

// Helper to get date string for N days ago (YYYY-MM-DD)
function getDaysAgoString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

async function fetchGDELTChunk(chunk: string[]): Promise<{ articles: NormalizedArticle[], rateLimited: boolean }> {
  // OR query for the chunk of tickers
  const query = encodeURIComponent(`(${chunk.map(t => `"${t}"`).join(' OR ')}) (stock OR market OR disruption OR competitor) sourcelang:eng`);
  // Timespan 3 days to match Finnhub, maxrecords 100 since we're batching
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=100&format=json&timespan=3d`;

  const maxTries = 3;
  let attempt = 0;

  while (attempt < maxTries) {
    try {
      const res = await fetch(url);
      
      if (res.status === 429) {
        attempt++;
        if (attempt >= maxTries) return { articles: [], rateLimited: true };
        // Exponential backoff: 6s, 12s, 24s (attempt 1 -> 6s, attempt 2 -> 12s)
        const backoff = 3000 * Math.pow(2, attempt); 
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }

      if (!res.ok) {
        return { articles: [], rateLimited: false };
      }
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        // GDELT sometimes returns HTTP 200 with a plain text error message
        return { articles: [], rateLimited: false };
      }

      if (!data.articles) return { articles: [], rateLimited: false };

      const articles = data.articles.map((art: any) => {
        // GDELT seendate format: YYYYMMDDTHHMMSSZ
        let date = new Date();
        if (art.seendate && art.seendate.length === 16) {
          const str = art.seendate;
          const year = str.slice(0, 4);
          const month = str.slice(4, 6);
          const day = str.slice(6, 8);
          const hour = str.slice(9, 11);
          const min = str.slice(11, 13);
          const sec = str.slice(13, 15);
          date = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
        }
        return {
          url: art.url,
          title: art.title || "No Title",
          source: art.domain || "GDELT",
          publishedAt: isNaN(date.getTime()) ? new Date() : date
        };
      });

      return { articles, rateLimited: false };
    } catch (error) {
      // Never throw, return empty
      return { articles: [], rateLimited: false };
    }
  }

  return { articles: [], rateLimited: true };
}

async function fetchFinnhubNews(ticker: string): Promise<NormalizedArticle[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];
  
  try {
    const from = getDaysAgoString(3); // Last 3 days
    const to = getDaysAgoString(0);   // Today
    const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((art: any) => ({
      url: art.url,
      title: art.headline,
      source: art.source || "Finnhub",
      publishedAt: art.datetime ? new Date(art.datetime * 1000) : new Date()
    }));
  } catch (error) {
    return [];
  }
}


export async function getNews(tickers: string[]): Promise<NormalizedArticle[]> {
  // Deduplicate tickers
  const uniqueTickers = Array.from(new Set(tickers));
  
  const allArticles: NormalizedArticle[] = [];
  const seenUrls = new Set<string>();

  const addArticles = (articles: NormalizedArticle[]) => {
    articles.forEach(art => {
      if (!seenUrls.has(art.url)) {
        seenUrls.add(art.url);
        allArticles.push(art);
      }
    });
  };

  console.log(`[getNews] Fetching news for ${uniqueTickers.length} unique tickers...`);

  // --- 1. Fetch GDELT (Batched) ---
  const chunkSize = 10;
  const chunks = [];
  for (let i = 0; i < uniqueTickers.length; i += chunkSize) {
    chunks.push(uniqueTickers.slice(i, i + chunkSize));
  }

  let rateLimitedTickersCount = 0;
  const baseDelay = parseInt(process.env.GDELT_DELAY_MS || '5000', 10);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const { articles, rateLimited } = await fetchGDELTChunk(chunk);
    
    if (rateLimited) {
      rateLimitedTickersCount += chunk.length;
    }
    
    addArticles(articles);

    // Throttle between GDELT chunks (>=5s + jitter)
    if (i < chunks.length - 1) {
      const jitter = Math.floor(Math.random() * 1000) - 500; // ±500ms
      await new Promise(r => setTimeout(r, Math.max(0, baseDelay + jitter)));
    }
  }

  if (rateLimitedTickersCount > 0) {
    console.warn(`[GDELT] rate-limited on ${rateLimitedTickersCount}/${uniqueTickers.length} tickers, served from Finnhub/Marketaux instead.`);
  }

  // --- 2. Fetch Finnhub (Per Ticker) ---
  for (const ticker of uniqueTickers) {
    const results = await Promise.allSettled([
      fetchFinnhubNews(ticker)
    ]);

    results.forEach(result => {
      if (result.status === "fulfilled") {
        addArticles(result.value);
      }
    });

    // Spacing for strict free tier limits of Finnhub/Marketaux
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log(`[getNews] Fetched ${allArticles.length} unique articles across ${uniqueTickers.length} tickers.`);
  return allArticles;
}
