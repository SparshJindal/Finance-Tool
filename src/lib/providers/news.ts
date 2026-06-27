import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";
import { fetchTavilyNews, fetchTavilyTopicNews, fetchTavilyQuestionNews } from "./tavily";

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
  return targets.filter(t => !cachedTickers.has(t.symbol));
}

async function markFetched(symbols: string[], provider: string) {
  const now = new Date();
  for (const symbol of symbols) {
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
    return t.exchange === "US" ? `("${t.name}" OR "${t.symbol}")` : `"${t.name}"`;
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
    return t.exchange === "US" ? t.symbol : `${t.symbol}.${t.exchange === 'NSE' ? 'NS' : t.exchange === 'BSE' ? 'BO' : t.exchange}`;
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

export async function getNews(targets: TickerInput[], skipHeavyApis: boolean = false): Promise<NormalizedArticle[]> {
  // Deduplicate targets by symbol
  const uniqueTargetsMap = new Map<string, TickerInput>();
  targets.forEach(t => uniqueTargetsMap.set(t.symbol, t));
  const uniqueTargets = Array.from(uniqueTargetsMap.values());
  
  const allArticles: NormalizedArticle[] = [];
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

  // --- 0. Fetch Tavily (PRIMARY — one query per holding) ---
  if (enabledProviders.includes('tavily')) {
    const tavilyTargets = await getMissingTickers(uniqueTargets, 'tavily');
    console.log(`[Tavily] Needs fetching for ${tavilyTargets.length}/${uniqueTargets.length} tickers.`);

    for (let i = 0; i < tavilyTargets.length; i++) {
      const target = tavilyTargets[i];

      // Check daily cap before each call
      const withinCap = await checkTavilyCap(1);
      if (!withinCap) {
        console.warn(`[Tavily] Daily cap exceeded (${process.env.TAVILY_DAILY_CAP || 500}). Stopping Tavily fetches.`);
        break;
      }

      const res = await fetchTavilyNews(target);
      addArticles(res, target);
      if (res.length > 0) {
        await markFetched([target.symbol], 'tavily');
      }

      // 300ms delay between queries to be polite to the API
      if (i < tavilyTargets.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }

  // --- 0a. Fetch Tavily QUESTION news (driven by watch-questions) ---
  if (enabledProviders.includes('tavily')) {
    // Only check targets that have questions
    const targetsWithQuestions = uniqueTargets.filter(t => t.questions && t.questions.length > 0);
    const maxQuestionsPerHolding = parseInt(process.env.TAVILY_QUESTIONS_PER_HOLDING || "3", 10);
    
    for (const target of targetsWithQuestions) {
      const questionsToRun = target.questions!.slice(0, maxQuestionsPerHolding);
      
      for (const q of questionsToRun) {
        const cacheKey = `${target.symbol}#${q.id}`;
        // Create a dummy TickerInput for the cache check
        const qTarget: TickerInput = { ...target, symbol: cacheKey };
        const missing = await getMissingTickers([qTarget], 'tavily-q');
        
        if (missing.length === 0) continue;

        const withinCap = await checkTavilyCap(1);
        if (!withinCap) {
          console.warn(`[Tavily-Q] Daily cap exceeded. Stopping question fetches.`);
          break;
        }

        const res = await fetchTavilyQuestionNews(target, q);
        // Tag with the question ID
        res.forEach(art => art.matchedQuestionId = q.id);
        
        addArticles(res, target);
        
        if (res.length > 0) {
          await markFetched([cacheKey], 'tavily-q');
        }

        await new Promise(r => setTimeout(r, 300));
      }
    }
  }

  // --- 0b. Fetch Tavily TOPIC news (industry/sector — deduped across all holdings) ---
  if (enabledProviders.includes('tavily')) {
    // Build deduplicated topic set and topic -> holdingIds map
    const topicToHoldings = new Map<string, string[]>();
    for (const t of uniqueTargets) {
      const topics: string[] = [];
      if (t.sector) topics.push(t.sector);
      if (t.themes) topics.push(...t.themes);
      for (const topic of topics) {
        const normalized = topic.trim().toLowerCase();
        if (!normalized || normalized === 'unknown') continue;
        if (!topicToHoldings.has(normalized)) {
          topicToHoldings.set(normalized, []);
        }
        if (t.holdingId) {
          topicToHoldings.get(normalized)!.push(t.holdingId);
        }
      }
    }

    if (topicToHoldings.size > 0) {
      // Check cache for topics (reuse getMissingTickers with provider "tavily-topic")
      const topicKeys = Array.from(topicToHoldings.keys());
      const topicInputs: TickerInput[] = topicKeys.map(topic => ({
        symbol: topic, // use topic string as the cache key
        name: topic,
        exchange: 'TOPIC',
      }));
      const missingTopics = await getMissingTickers(topicInputs, 'tavily-topic');
      console.log(`[Tavily-Topic] Needs fetching for ${missingTopics.length}/${topicKeys.length} topics.`);

      for (let i = 0; i < missingTopics.length; i++) {
        const topicInput = missingTopics[i];
        const topic = topicInput.symbol;

        // Check daily cap before each call
        const withinCap = await checkTavilyCap(1);
        if (!withinCap) {
          console.warn(`[Tavily-Topic] Daily cap exceeded. Stopping topic fetches.`);
          break;
        }

        const res = await fetchTavilyTopicNews(topic);
        
        // Tag each article with ALL holdingIds that share this topic
        const matchedIds = topicToHoldings.get(topic) || [];
        for (const art of res) {
          let existing = allArticles.find(a => a.url === art.url);
          if (!existing) {
            art.matchedHoldingIds = [...matchedIds];
            allArticles.push(art);
          } else {
            // Merge holdingIds into existing article
            if (!existing.matchedHoldingIds) existing.matchedHoldingIds = [];
            for (const hid of matchedIds) {
              if (!existing.matchedHoldingIds.includes(hid)) {
                existing.matchedHoldingIds.push(hid);
              }
            }
          }
        }

        if (res.length > 0) {
          await markFetched([topic], 'tavily-topic');
        }

        // 300ms delay between topic queries
        if (i < missingTopics.length - 1) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }
  }

  // --- 1. Fetch GDELT (Fallback — batched) ---
  if (enabledProviders.includes('gdelt')) {
    const gdeltTargets = await getMissingTickers(uniqueTargets, 'gdelt');
    console.log(`[GDELT] Needs fetching for ${gdeltTargets.length}/${uniqueTargets.length} tickers.`);
    
    if (gdeltTargets.length > 0) {
      const chunkSize = 10;
      const chunks = [];
      for (let i = 0; i < gdeltTargets.length; i += chunkSize) {
        chunks.push(gdeltTargets.slice(i, i + chunkSize));
      }

      const baseDelay = parseInt(process.env.GDELT_DELAY_MS || '5000', 10);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const { articles: baseArticles } = await fetchGDELTChunk(chunk);
        const { articles: themeArticles } = await fetchGDELTThemeChunk(chunk);
        
        // Pass undefined as target for GDELT chunks since it's a batch query.
        // We will rely on string matching later if GDELT returns articles.
        addArticles(baseArticles);
        addArticles(themeArticles);
        if ((baseArticles.length + themeArticles.length) > 0) {
          await markFetched(chunk.map(c => c.symbol), 'gdelt');
        }

        if (i < chunks.length - 1) {
          const jitter = Math.floor(Math.random() * 1000) - 500;
          await new Promise(r => setTimeout(r, Math.max(0, baseDelay + jitter)));
        }
      }
    }
  }

  // --- 2. Determine Enrichment Targets ---
  // Only call Marketaux/Finnhub for tickers where Tavily+GDELT returned zero articles
  const enrichmentTargets = uniqueTargets.filter(t => {
    const hasArticle = allArticles.some(a => 
      a.title.toLowerCase().includes(t.symbol.toLowerCase()) || 
      a.title.toLowerCase().includes(t.name.toLowerCase())
    );
    return !hasArticle;
  });

  if (enrichmentTargets.length > 0 && !skipHeavyApis) {
    console.log(`[Enrichment] ${enrichmentTargets.length} tickers lacked Tavily/GDELT results. Proceeding with heavy APIs...`);
    
    // --- 3. Fetch Finnhub (US Only) ---
    if (enabledProviders.includes('finnhub')) {
      const finnhubTargets = await getMissingTickers(enrichmentTargets, 'finnhub');
      for (const target of finnhubTargets) {
        if (target.exchange === "US") {
          const res = await fetchFinnhubNews(target);
          addArticles(res, target);
          if (res.length > 0) {
            await markFetched([target.symbol], 'finnhub');
          }
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    // --- 4. Fetch Marketaux (Batched) ---
    if (enabledProviders.includes('marketaux')) {
      const marketauxTargets = await getMissingTickers(enrichmentTargets, 'marketaux');
      if (marketauxTargets.length > 0) {
        const chunkSize = parseInt(process.env.MARKETAUX_SYMBOLS_PER_REQUEST || "3", 10);
        console.log(`[Marketaux] Batching ${marketauxTargets.length} tickers into chunks of ${chunkSize}.`);
        
        for (let i = 0; i < marketauxTargets.length; i += chunkSize) {
          const chunk = marketauxTargets.slice(i, i + chunkSize);
          const res = await fetchMarketauxBatched(chunk);
          // Pass undefined as target for batch chunk.
          addArticles(res);
          if (res.length > 0) {
            await markFetched(chunk.map(c => c.symbol), 'marketaux');
          }
          
          if (process.env.NEWS_MOCK !== 'true' && i + chunkSize < marketauxTargets.length) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        }
      }
    }
  } else if (skipHeavyApis) {
    console.warn(`[getNews] Skipping Finnhub & Marketaux to preserve API limits (skipHeavyApis=true).`);
  }

  console.log(`[getNews] Fetched ${allArticles.length} unique new articles across ${uniqueTargets.length} tickers.`);
  
  if (allArticles.length > 0) {
    console.log(`[getNews] --- RAW ARTICLES PULLED ---`);
    allArticles.forEach((art, idx) => {
      console.log(`  ${idx + 1}. [${art.source}] ${art.title} (${art.url})`);
    });
    console.log(`[getNews] ---------------------------`);
  }

  return allArticles;
}
