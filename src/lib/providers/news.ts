export interface NormalizedArticle {
  url: string;
  title: string;
  source: string;
  publishedAt: Date;
}

export interface TickerInput {
  symbol: string;
  name: string;
  exchange: string;
  sector?: string;
  themes?: string[];
}

// Helper to get date string for N days ago (YYYY-MM-DD)
function getDaysAgoString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

async function fetchGDELTChunk(chunk: TickerInput[]): Promise<{ articles: NormalizedArticle[], rateLimited: boolean }> {
  // OR query for the chunk using name and sector if available
  const queryTerms = chunk.map(t => {
    let term = `"${t.name}"`;
    if (t.sector) {
      term += ` OR ("${t.symbol}" AND "${t.sector}")`;
    } else {
      term += ` OR "${t.symbol}"`;
    }
    return `(${term})`;
  }).join(' OR ');

  const query = encodeURIComponent(`(${queryTerms}) (stock OR market OR disruption OR competitor) sourcelang:eng`);
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

async function fetchFinnhubNews(target: TickerInput): Promise<NormalizedArticle[]> {
  if (target.exchange !== "US") return [];
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];
  
  const ticker = target.symbol;
  try {
    const from = getDaysAgoString(3); // Last 3 days
    const to = getDaysAgoString(0);   // Today
    const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Finnhub] Error fetching ${ticker}: HTTP ${res.status} - ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    console.log(`[Finnhub] Fetched ${Array.isArray(data) ? data.length : 0} raw articles for ${ticker} from ${from} to ${to}`);
    
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

async function fetchMarketauxNews(target: TickerInput): Promise<NormalizedArticle[]> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) return [];
  
  const ticker = target.symbol; // E.g., TCS
  const searchStr = target.exchange === "US" ? ticker : `${ticker}.${target.exchange === 'NSE' ? 'NS' : target.exchange === 'BSE' ? 'BO' : target.exchange}`;

  try {
    const publishedAfter = getDaysAgoString(3) + "T00:00:00";
    const url = `https://api.marketaux.com/v1/news/all?symbols=${searchStr}&filter_entities=true&limit=10&published_after=${publishedAfter}&api_token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Marketaux] Error fetching ${ticker}: HTTP ${res.status} - ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    const articles = data.data;
    console.log(`[Marketaux] Fetched ${Array.isArray(articles) ? articles.length : 0} raw articles for ${ticker}`);
    
    if (!Array.isArray(articles)) return [];

    return articles.map((art: any) => ({
      url: art.url,
      title: art.title,
      source: art.source || "Marketaux",
      publishedAt: art.published_at ? new Date(art.published_at) : new Date()
    }));
  } catch (error) {
    return [];
  }
}

export async function getNews(targets: TickerInput[]): Promise<NormalizedArticle[]> {
  // Deduplicate targets by symbol
  const uniqueTargetsMap = new Map<string, TickerInput>();
  targets.forEach(t => uniqueTargetsMap.set(t.symbol, t));
  const uniqueTargets = Array.from(uniqueTargetsMap.values());
  
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

  console.log(`[getNews] Fetching news for ${uniqueTargets.length} unique tickers...`);

  // --- 1. Fetch GDELT (Batched) ---
  const chunkSize = 10;
  const chunks = [];
  for (let i = 0; i < uniqueTargets.length; i += chunkSize) {
    chunks.push(uniqueTargets.slice(i, i + chunkSize));
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
    console.warn(`[GDELT] rate-limited on ${rateLimitedTickersCount}/${uniqueTargets.length} tickers, served from Finnhub/Marketaux instead.`);
  }

  // --- 2. Fetch Finnhub & Marketaux (Per Ticker) ---
  for (const target of uniqueTargets) {
    const results = await Promise.allSettled([
      fetchFinnhubNews(target),
      fetchMarketauxNews(target)
    ]);

    results.forEach(result => {
      if (result.status === "fulfilled") {
        addArticles(result.value);
      }
    });

    // Spacing for strict free tier limits of Finnhub/Marketaux
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log(`[getNews] Fetched ${allArticles.length} unique articles across ${uniqueTargets.length} tickers.`);
  
  if (allArticles.length > 0) {
    console.log(`[getNews] --- RAW ARTICLES PULLED ---`);
    allArticles.forEach((art, idx) => {
      console.log(`  ${idx + 1}. [${art.source}] ${art.title} (${art.url})`);
    });
    console.log(`[getNews] ---------------------------`);
  }

  return allArticles;
}
