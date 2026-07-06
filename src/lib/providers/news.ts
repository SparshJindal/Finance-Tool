import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";
import { fetchTavilyNews, fetchTavilyTopicNews, fetchTavilyQuestionNews, fetchTavilyCatalystNews } from "./tavily";
import { metricsStorage } from "../metrics";

export interface NormalizedArticle {
  url: string;
  title: string;
  source: string;
  publishedAt: Date;
  /** Optional excerpt/snippet from the search provider — avoids live scraping */
  excerpt?: string;
  /** Tracks which holdings caused this article to be fetched */
  matchedHoldingIds?: string[];
  /** Optional: tracks which specific watch-question (if any) this article was fetched to answer */
  matchedQuestionId?: string;
  /** How the article was retrieved — used by the pre-judge relevance filter */
  retrievalSource?: 'primary' | 'question' | 'topic';
}

export interface TickerInput {
  holdingId?: string;
  symbol: string;
  name: string;
  exchange: string;
  sector?: string;
  themes?: string[];
  aliases?: string[];
  questions?: { id: string; text: string }[];
  competitors?: { ticker?: string; name: string }[];
}

// Helper to get date string for N days ago (YYYY-MM-DD)
function getDaysAgoString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

async function getMissingTickers(targets: TickerInput[], provider: string): Promise<TickerInput[]> {
  const ttlHours = parseInt(process.env.NEWS_CACHE_TTL_HOURS || "12", 10);
  const cutoff = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
  
  const logs = await prisma.newsFetchLog.findMany({
    where: {
      provider,
      ticker: { in: targets.map(t => t.symbol) },
      fetchedAt: { gte: cutoff }
    }
  });
  
  const cachedTickers = new Set(logs.map(l => l.ticker));
  
  const collector = metricsStorage.getStore();
  
  return targets.filter(t => {
    if (cachedTickers.has(t.symbol)) {
      if (collector) collector.addCacheHit();
      return false;
    } else {
      if (collector) collector.addCacheMiss();
      return true;
    }
  });
}

export async function markFetched(stamps: { symbol: string, provider: string }[]) {
  const now = new Date();
  for (const { symbol, provider } of stamps) {
    await prisma.newsFetchLog.upsert({
      where: { ticker_provider: { ticker: symbol, provider } },
      update: { fetchedAt: now },
      create: { ticker: symbol, provider, fetchedAt: now }
    });
  }
}

async function checkMarketauxQuota(incrementBy: number = 0): Promise<boolean> {
  const dateStr = new Date().toISOString().split('T')[0];
  const cap = parseInt(process.env.MARKETAUX_DAILY_CAP || "90", 10);
  
  if (incrementBy > 0) {
    const record = await prisma.dailyRequestCount.upsert({
      where: { provider_date: { provider: "marketaux", date: dateStr } },
      update: { count: { increment: incrementBy } },
      create: { provider: "marketaux", date: dateStr, count: incrementBy }
    });
    return record.count <= cap;
  } else {
    const record = await prisma.dailyRequestCount.findUnique({
      where: { provider_date: { provider: "marketaux", date: dateStr } }
    });
    return (record?.count || 0) < cap;
  }
}

async function checkTavilyCap(incrementBy: number = 0): Promise<boolean> {
  const dateStr = new Date().toISOString().split('T')[0];
  const cap = parseInt(process.env.TAVILY_DAILY_CAP || "500", 10);
  
  if (incrementBy > 0) {
    const record = await prisma.dailyRequestCount.upsert({
      where: { provider_date: { provider: "tavily", date: dateStr } },
      update: { count: { increment: incrementBy } },
      create: { provider: "tavily", date: dateStr, count: incrementBy }
    });
    return record.count <= cap;
  } else {
    const record = await prisma.dailyRequestCount.findUnique({
      where: { provider_date: { provider: "tavily", date: dateStr } }
    });
    return (record?.count || 0) < cap;
  }
}

async function executeGDELTQuery(url: string): Promise<{ articles: NormalizedArticle[], rateLimited: boolean }> {
  const maxTries = 3;
  let attempt = 0;

  while (attempt < maxTries) {
    try {
      const res = await fetch(url);
      
      if (res.status === 429) {
        attempt++;
        if (attempt >= maxTries) return { articles: [], rateLimited: true };
        const backoff = 3000 * Math.pow(2, attempt); 
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }

      if (!res.ok) return { articles: [], rateLimited: false };
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        return { articles: [], rateLimited: false };
      }

      if (!data.articles) return { articles: [], rateLimited: false };

      const articles = data.articles.map((art: any) => {
        let date = new Date();
        if (art.seendate && art.seendate.length === 16) {
          const str = art.seendate;
          date = new Date(`${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}T${str.slice(9, 11)}:${str.slice(11, 13)}:${str.slice(13, 15)}Z`);
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
      return { articles: [], rateLimited: false };
    }
  }
  return { articles: [], rateLimited: true };
}

async function fetchGDELTChunk(chunk: TickerInput[]): Promise<{ articles: NormalizedArticle[], rateLimited: boolean }> {
  const queryTerms = chunk.map(t => {
    const cleanSymbol = t.symbol.split('.')[0];
    return t.exchange === "US" ? `("${t.name}" OR "${cleanSymbol}")` : `"${t.name}"`;
  }).join(' OR ');

  const query = encodeURIComponent(`(${queryTerms}) (stock OR market OR disruption OR competitor) sourcelang:eng`);
  let url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=100&format=json&timespan=3d`;

  if (chunk.some(t => t.exchange === 'NSE' || t.exchange === 'BSE')) {
    url += '&sourcecountry=IN';
  }

  return executeGDELTQuery(url);
}

async function fetchGDELTThemeChunk(chunk: TickerInput[]): Promise<{ articles: NormalizedArticle[], rateLimited: boolean }> {
  const targetsWithThemes = chunk.filter(t => t.themes && t.themes.length > 0);
  if (targetsWithThemes.length === 0) return { articles: [], rateLimited: false };

  const queryTerms = targetsWithThemes.map(t => {
    const themeStr = t.themes!.map(th => `"${th}"`).join(' OR ');
    return `(${themeStr})`;
  }).join(' OR ');

  const query = encodeURIComponent(`(${queryTerms}) sourcelang:eng`);
  let url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=50&format=json&timespan=3d`;

  if (targetsWithThemes.some(t => t.exchange === 'NSE' || t.exchange === 'BSE')) {
    url += '&sourcecountry=IN';
  }

  return executeGDELTQuery(url);
}

async function fetchFinnhubNews(target: TickerInput): Promise<NormalizedArticle[]> {
  if (target.exchange !== "US") return [];
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return [];
  
  const ticker = target.symbol;
  try {
    const from = getDaysAgoString(3);
    const to = getDaysAgoString(0);
    const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Finnhub] Error fetching ${ticker}: HTTP ${res.status} - ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    console.log(`[Finnhub] Fetched ${Array.isArray(data) ? data.length : 0} raw articles for ${ticker}`);
    
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

async function fetchMarketauxBatched(targets: TickerInput[]): Promise<NormalizedArticle[]> {
  const isMock = process.env.NEWS_MOCK === 'true';
  if (isMock) {
    console.log(`[Marketaux] MOCK MODE enabled. Returning local fixture for ${targets.length} symbols.`);
    try {
      const fixturePath = path.join(process.cwd(), 'src', 'lib', '__fixtures__', 'marketaux-sample.json');
      const data = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
      return data.data.map((art: any) => ({
        url: art.url,
        title: art.title,
        source: art.source || "Marketaux",
        publishedAt: art.published_at ? new Date(art.published_at) : new Date()
      }));
    } catch (e) {
      console.error("Mock fixture error:", e);
      return [];
    }
  }

  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) return [];

  const searchStrs = targets.map(t => {
    const cleanSymbol = t.symbol.split('.')[0];
    return t.exchange === "US" ? cleanSymbol : `${cleanSymbol}.${t.exchange === 'NSE' ? 'NS' : t.exchange === 'BSE' ? 'BO' : t.exchange}`;
  });
  
  const searchStr = searchStrs.join(',');
  
  // Check and increment quota
  const withinQuota = await checkMarketauxQuota(1);
  if (!withinQuota) {
    console.warn(`[Marketaux] Daily quota exceeded (${process.env.MARKETAUX_DAILY_CAP}). Skipping fetch for batch.`);
    return [];
  }

  try {
    const publishedAfter = getDaysAgoString(3) + "T00:00:00";
    const url = `https://api.marketaux.com/v1/news/all?symbols=${searchStr}&filter_entities=true&limit=10&published_after=${publishedAfter}&api_token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[Marketaux] Error fetching ${searchStr}: HTTP ${res.status} - ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    const articles = data.data;
    console.log(`[Marketaux] Fetched ${Array.isArray(articles) ? articles.length : 0} raw articles for batch: ${searchStr}`);
    
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

export async function getNews(targets: TickerInput[], skipHeavyApis: boolean = false): Promise<{ articles: NormalizedArticle[], cacheStamps: { symbol: string, provider: string }[] }> {
  // Deduplicate targets by symbol
  const uniqueTargetsMap = new Map<string, TickerInput>();
  targets.forEach(t => uniqueTargetsMap.set(t.symbol, t));
  const uniqueTargets = Array.from(uniqueTargetsMap.values());
  
  const allArticles: NormalizedArticle[] = [];
  const cacheStamps: { symbol: string, provider: string }[] = [];
  const seenUrls = new Set<string>();

  const addArticles = (articles: NormalizedArticle[], target?: TickerInput) => {
    articles.forEach(art => {
      let existing = allArticles.find(a => a.url === art.url);
      if (!existing) {
        art.matchedHoldingIds = target?.holdingId ? [target.holdingId] : [];
        allArticles.push(art);
      } else {
        if (target?.holdingId && (!existing.matchedHoldingIds || !existing.matchedHoldingIds.includes(target.holdingId))) {
          if (!existing.matchedHoldingIds) existing.matchedHoldingIds = [];
          existing.matchedHoldingIds.push(target.holdingId);
        }
      }
    });
  };

  const enabledProviders = (process.env.NEWS_PROVIDERS || "tavily,gdelt,finnhub,marketaux").toLowerCase().split(',');
  console.log(`[getNews] Enabled providers: ${enabledProviders.join(', ')}`);
  console.log(`[getNews] Fetching news for ${uniqueTargets.length} unique tickers...`);

  const { newsLimiter } = await import('@/lib/limiters');

  const fetchTasks: Promise<void>[] = [];

  // --- 0a. Fetch Tavily (CATALYST) ---
  if (enabledProviders.includes('tavily')) {
    const catalystQueries = uniqueTargets.map(t => ({ target: t, cacheKey: `${t.symbol}#catalyst` }));
    const cacheInputs: TickerInput[] = catalystQueries.map(cq => ({ symbol: cq.cacheKey, name: cq.cacheKey, exchange: 'CATALYST' }));
    const missingInputs = await getMissingTickers(cacheInputs, 'tavily-catalyst');
    const missingKeys = new Set(missingInputs.map(i => i.symbol));
    const uncachedQueries = catalystQueries.filter(cq => missingKeys.has(cq.cacheKey));

    uncachedQueries.forEach(({ target, cacheKey }) => {
      fetchTasks.push(newsLimiter(async () => {
        const withinCap = await checkTavilyCap(1);
        if (!withinCap) return;
        const res = await fetchTavilyCatalystNews(target);
        res.forEach(art => art.retrievalSource = 'primary');
        addArticles(res, target);
        if (res.length > 0) cacheStamps.push({ symbol: cacheKey, provider: 'tavily-catalyst' });
      }));
    });
  }

  // --- 0b. Fetch Tavily (PRIMARY) ---
  if (enabledProviders.includes('tavily')) {
    const tavilyTargets = await getMissingTickers(uniqueTargets, 'tavily');
    tavilyTargets.forEach(target => {
      fetchTasks.push(newsLimiter(async () => {
        const withinCap = await checkTavilyCap(1);
        if (!withinCap) return;
        const res = await fetchTavilyNews(target);
        res.forEach(art => art.retrievalSource = 'primary');
        addArticles(res, target);
        if (res.length > 0) cacheStamps.push({ symbol: target.symbol, provider: 'tavily' });
      }));
    });
  }

  // --- 0c. Fetch Tavily (QUESTION) ---
  if (enabledProviders.includes('tavily')) {
    const targetsWithQuestions = uniqueTargets.filter(t => t.questions && t.questions.length > 0);
    const maxQuestionsPerHolding = parseInt(process.env.TAVILY_QUESTIONS_PER_HOLDING || "3", 10);
    
    targetsWithQuestions.forEach(target => {
      const questionsToRun = target.questions!.slice(0, maxQuestionsPerHolding);
      questionsToRun.forEach(q => {
        const cacheKey = `${target.symbol}#${q.id}`;
        fetchTasks.push(newsLimiter(async () => {
          const qTarget: TickerInput = { ...target, symbol: cacheKey };
          const missing = await getMissingTickers([qTarget], 'tavily-q');
          if (missing.length === 0) return;
          const withinCap = await checkTavilyCap(1);
          if (!withinCap) return;

          const res = await fetchTavilyQuestionNews(target, q);
          res.forEach(art => {
            art.matchedQuestionId = q.id;
            art.retrievalSource = 'question';
          });
          addArticles(res, target);
          if (res.length > 0) cacheStamps.push({ symbol: cacheKey, provider: 'tavily-q' });
        }));
      });
    });
  }

  // --- 0d. Fetch Tavily (TOPIC) ---
  if (enabledProviders.includes('tavily')) {
    const topicQueries: { companyName: string; topic: string; holdingId: string; cacheKey: string }[] = [];
    const MAX_TOPICS_PER_HOLDING = 2;

    uniqueTargets.forEach(t => {
      if (!t.holdingId) return;
      const topics = (t.themes || []).slice(0, MAX_TOPICS_PER_HOLDING);
      topics.forEach(topic => {
        const normalized = topic.trim().toLowerCase();
        if (!normalized || normalized === 'unknown' || normalized.split(/\s+/).length < 2) return;
        const cacheKey = `${t.symbol}#${normalized}`;
        topicQueries.push({ companyName: t.name, topic: normalized, holdingId: t.holdingId as string, cacheKey });
      });
    });

    if (topicQueries.length > 0) {
      const cacheInputs: TickerInput[] = topicQueries.map(tq => ({ symbol: tq.cacheKey, name: tq.cacheKey, exchange: 'TOPIC' }));
      const missingInputs = await getMissingTickers(cacheInputs, 'tavily-topic');
      const missingKeys = new Set(missingInputs.map(i => i.symbol));
      const uncachedQueries = topicQueries.filter(tq => missingKeys.has(tq.cacheKey));

      uncachedQueries.forEach(tq => {
        fetchTasks.push(newsLimiter(async () => {
          const withinCap = await checkTavilyCap(1);
          if (!withinCap) return;
          const res = await fetchTavilyTopicNews(tq.companyName, tq.topic);
          res.forEach(art => art.retrievalSource = 'topic');
          for (const art of res) {
            let existing = allArticles.find(a => a.url === art.url);
            if (!existing) {
              art.matchedHoldingIds = [tq.holdingId];
              allArticles.push(art);
            } else {
              if (!existing.matchedHoldingIds) existing.matchedHoldingIds = [];
              if (!existing.matchedHoldingIds.includes(tq.holdingId)) {
                existing.matchedHoldingIds.push(tq.holdingId);
              }
            }
          }
          if (res.length > 0) cacheStamps.push({ symbol: tq.cacheKey, provider: 'tavily-topic' });
        }));
      });
    }
  }

  // --- 1. Fetch GDELT ---
  if (enabledProviders.includes('gdelt') && !skipHeavyApis) {
    const gdeltTargets = await getMissingTickers(uniqueTargets, 'gdelt');
    if (gdeltTargets.length > 0) {
      const chunkSize = 10;
      for (let i = 0; i < gdeltTargets.length; i += chunkSize) {
        const chunk = gdeltTargets.slice(i, i + chunkSize);
        fetchTasks.push(newsLimiter(async () => {
          const { articles: baseArticles } = await fetchGDELTChunk(chunk);
          const { articles: themeArticles } = await fetchGDELTThemeChunk(chunk);
          addArticles(baseArticles);
          addArticles(themeArticles);
          if ((baseArticles.length + themeArticles.length) > 0) {
            chunk.forEach(c => cacheStamps.push({ symbol: c.symbol, provider: 'gdelt' }));
          }
        }));
      }
    }
  }

  // --- 2. Fetch Finnhub (US Only) ---
  if (enabledProviders.includes('finnhub') && !skipHeavyApis) {
    const finnhubTargets = await getMissingTickers(uniqueTargets, 'finnhub');
    finnhubTargets.forEach(target => {
      if (target.exchange === "US") {
        fetchTasks.push(newsLimiter(async () => {
          const res = await fetchFinnhubNews(target);
          addArticles(res, target);
          if (res.length > 0) cacheStamps.push({ symbol: target.symbol, provider: 'finnhub' });
        }));
      }
    });
  }

  // --- 3. Fetch Marketaux (Batched) ---
  if (enabledProviders.includes('marketaux') && !skipHeavyApis) {
    const marketauxTargets = await getMissingTickers(uniqueTargets, 'marketaux');
    if (marketauxTargets.length > 0) {
      const chunkSize = parseInt(process.env.MARKETAUX_SYMBOLS_PER_REQUEST || "3", 10);
      for (let i = 0; i < marketauxTargets.length; i += chunkSize) {
        const chunk = marketauxTargets.slice(i, i + chunkSize);
        fetchTasks.push(newsLimiter(async () => {
          const res = await fetchMarketauxBatched(chunk);
          addArticles(res);
          if (res.length > 0) chunk.forEach(c => cacheStamps.push({ symbol: c.symbol, provider: 'marketaux' }));
        }));
      }
    }
  }

  await Promise.allSettled(fetchTasks);

  console.log(`[getNews] Fetched ${allArticles.length} unique new articles across ${uniqueTargets.length} tickers.`);
  
  if (allArticles.length > 0) {
    console.log(`[getNews] --- RAW ARTICLES PULLED ---`);
    allArticles.forEach((art, idx) => {
      console.log(`  ${idx + 1}. [${art.source}] ${art.title} (${art.url})`);
    });
    console.log(`[getNews] ---------------------------`);
  }

  return { articles: allArticles, cacheStamps };
}
