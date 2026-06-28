import type { NormalizedArticle, TickerInput } from "./news";

/**
 * Tavily Search API provider.
 *
 * Uses POST https://api.tavily.com/search with topic:"news" to fetch
 * recent articles for a given holding. Returns NormalizedArticle[] with
 * the optional `excerpt` field populated from the API's `content` snippet.
 *
 * IMPORTANT: TAVILY_API_KEY must be set in both .env (local) and in
 * Vercel project env (Production) — otherwise this provider silently no-ops.
 */

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

/**
 * Build a disambiguated query for a holding.
 * Uses the full company name in quotes for exact matching, plus the ticker
 * symbol for US stocks. Adds negative terms for top competitors to prevent
 * confusion (e.g. "Microchip Technology" pulling Micron results).
 */
function buildQuery(target: TickerInput): string {
  const parts: string[] = [];

  // Primary: full company name in quotes for exact phrase matching
  parts.push(`"${target.name}"`);

  // Add ticker symbol for additional disambiguation (helps for US stocks)
  const exchange = target.exchange?.toUpperCase();
  if (exchange !== "NSE" && exchange !== "BSE" && exchange !== "NS" && exchange !== "BO") {
    parts.push(target.symbol);
  }

  // Always add "stock news" for financial context
  parts.push("stock news");

  // For Indian stocks, append "India" for disambiguation
  if (exchange === "NSE" || exchange === "BSE" || exchange === "NS" || exchange === "BO") {
    parts.push("India");
  }

  // Add negative terms for top competitors to reduce confusion
  // (e.g. exclude "Micron" for MCHP to avoid cross-contamination)
  if (target.competitors && target.competitors.length > 0) {
    const negatives = target.competitors.slice(0, 2);
    for (const comp of negatives) {
      if (comp.name && comp.name.toLowerCase() !== target.name.toLowerCase()) {
        parts.push(`-"${comp.name}"`);
      }
    }
  }

  return parts.join(" ");
}

/**
 * Map the Tavily `time_range` parameter from TAVILY_NEWS_DAYS env.
 * Tavily accepts: "d" (day), "w" (week), "m" (month), "y" (year).
 */
function getTimeRange(): string {
  const days = parseInt(process.env.TAVILY_NEWS_DAYS || "3", 10);
  if (days <= 1) return "d";
  if (days <= 7) return "w";
  if (days <= 30) return "m";
  return "y";
}

/**
 * Shared Tavily search helper — makes a single POST and returns NormalizedArticle[].
 * Never throws — logs errors and returns [].
 */
async function tavilySearch(query: string, maxResults: number, label: string): Promise<NormalizedArticle[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[Tavily] TAVILY_API_KEY is not set. Skipping Tavily provider. Get a free key at https://tavily.com");
    return [];
  }

  const timeRange = getTimeRange();

  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        topic: "news",
        time_range: timeRange,
        max_results: maxResults,
        include_answer: false,
        include_images: false,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.warn(`[Tavily] HTTP ${res.status} for "${label}" (query: "${query}"): ${errorText.slice(0, 200)}`);
      return [];
    }

    const data = await res.json();

    if (!data.results || !Array.isArray(data.results)) {
      console.warn(`[Tavily] No results array in response for "${label}"`);
      return [];
    }

    const articles: NormalizedArticle[] = data.results
      .filter((r: any) => r.url && r.title)
      .map((r: any) => {
        // Parse published date; fall back to now
        let publishedAt = new Date();
        if (r.published_date) {
          const parsed = new Date(r.published_date);
          if (!isNaN(parsed.getTime())) {
            publishedAt = parsed;
          }
        }

        // Derive source from URL hostname
        let source = "Tavily";
        try {
          source = new URL(r.url).hostname.replace(/^www\./, "");
        } catch {
          // keep default
        }

        return {
          url: r.url,
          title: r.title,
          source,
          publishedAt,
          excerpt: r.content || undefined,
        };
      });

    console.log(`[Tavily] Fetched ${articles.length} articles for "${label}" (query: "${query}")`);
    return articles;
  } catch (error: any) {
    console.error(`[Tavily] Network error for "${label}":`, error.message || error);
    return [];
  }
}

/**
 * Fetch news articles for a single holding via the Tavily Search API.
 * Returns NormalizedArticle[] with excerpt populated.
 * Never throws — logs errors and returns [].
 */
export async function fetchTavilyNews(target: TickerInput): Promise<NormalizedArticle[]> {
  const query = buildQuery(target);
  const maxResults = parseInt(process.env.TAVILY_MAX_RESULTS || "10", 10);
  return tavilySearch(query, maxResults, target.name);
}

/**
 * Fetch industry/sector news for a topic, ANCHORED to a specific company.
 * This ensures topic queries return articles relevant to the holding, not
 * generic industry noise.
 * Never throws — logs errors and returns [].
 */
export async function fetchTavilyTopicNews(companyName: string, topic: string): Promise<NormalizedArticle[]> {
  const query = `"${companyName}" ${topic}`;
  return tavilySearch(query, 5, `topic:${companyName}/${topic}`);
}

/**
 * Fetch news articles answering a specific watch-question.
 * Lightly grounds the query with the company name if the question doesn't contain it.
 * Never throws — logs errors and returns [].
 */
export async function fetchTavilyQuestionNews(target: TickerInput, question: { id: string, text: string }): Promise<NormalizedArticle[]> {
  const parts: string[] = [];

  // Ground with company name if the question doesn't mention it
  if (!question.text.toLowerCase().includes(target.name.toLowerCase())) {
    parts.push(target.name);
  }

  parts.push(question.text);

  // For Indian stocks, append "India" for disambiguation
  const exchange = target.exchange?.toUpperCase();
  if (exchange === "NSE" || exchange === "BSE" || exchange === "NS" || exchange === "BO") {
    parts.push("India");
  }

  const query = parts.join(" ");
  // Use a smaller cap for question-specific queries
  return tavilySearch(query, 3, `q:${question.id}`);
}
