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

async function fetchGDELT(ticker: string): Promise<NormalizedArticle[]> {
  try {
    const query = encodeURIComponent(`"${ticker}" (stock OR market OR disruption OR competitor) sourcelang:eng`);
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=20&format=json`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[GDELT Warning for ${ticker}]: ${res.statusText}`);
      return [];
    }
    
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      // GDELT sometimes returns HTTP 200 with a plain text error message
      console.warn(`[GDELT Warning] Non-JSON response for ${ticker}. Text: ${text.substring(0, 50)}...`);
      return [];
    }

    if (!data.articles) return [];

    return data.articles.map((art: any) => {
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
  } catch (error) {
    console.error(`[GDELT Error for ${ticker}]:`, error);
    return [];
  }
}

async function fetchFinnhubNews(ticker: string): Promise<NormalizedArticle[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];
  
  try {
    const from = getDaysAgoString(3); // Last 3 days
    const to = getDaysAgoString(0);   // Today
    const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Finnhub Warning for ${ticker}]: ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((art: any) => ({
      url: art.url,
      title: art.headline,
      source: art.source || "Finnhub",
      publishedAt: art.datetime ? new Date(art.datetime * 1000) : new Date()
    }));
  } catch (error) {
    console.error(`[Finnhub Error for ${ticker}]:`, error);
    return [];
  }
}

async function fetchMarketaux(ticker: string): Promise<NormalizedArticle[]> {
  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) return [];
  
  try {
    const url = `https://api.marketaux.com/v1/news/all?symbols=${ticker}&filter_entities=true&language=en&api_token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Marketaux Warning for ${ticker}]: ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data.map((art: any) => ({
      url: art.url,
      title: art.title,
      source: art.source || "Marketaux",
      publishedAt: art.published_at ? new Date(art.published_at) : new Date()
    }));
  } catch (error) {
    console.error(`[Marketaux Error for ${ticker}]:`, error);
    return [];
  }
}

export async function getNews(tickers: string[]): Promise<NormalizedArticle[]> {
  const allArticles: NormalizedArticle[] = [];
  const seenUrls = new Set<string>();

  for (const ticker of tickers) {
    console.log(`[getNews] Fetching news for ${ticker}...`);
    
    // Fire all three providers concurrently for this ticker
    const results = await Promise.allSettled([
      fetchGDELT(ticker),
      fetchFinnhubNews(ticker),
      fetchMarketaux(ticker)
    ]);

    results.forEach(result => {
      if (result.status === "fulfilled") {
        result.value.forEach(art => {
          if (!seenUrls.has(art.url)) {
            seenUrls.add(art.url);
            allArticles.push(art);
          }
        });
      }
    });

    // Increase rate-limit buffer to respect GDELT and Finnhub strict free tiers
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log(`[getNews] Fetched ${allArticles.length} unique articles across ${tickers.length} tickers.`);
  return allArticles;
}
