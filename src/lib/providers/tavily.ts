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
 * Build a smart natural-language query for a holding.
 * Uses company NAME (never the raw ticker symbol for Indian stocks),
 * enriched with up to 2 themes for better recall.
 */
function buildQuery(target: TickerInput): string {
  const parts: string[] = [];

  // Primary: company name
  parts.push(target.name);

  // Always add "stock news" for financial context
  parts.push("stock news");

  // Enrich with up to 2 themes if available
  if (target.themes && target.themes.length > 0) {
    parts.push(...target.themes.slice(0, 2));
  }

  // For Indian stocks, append "India" for disambiguation
  const exchange = target.exchange?.toUpperCase();
  if (exchange === "NSE" || exchange === "BSE" || exchange === "NS" || exchange === "BO") {
    parts.push("India");
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
 * Fetch news articles for a single holding via the Tavily Search API.
 * Returns NormalizedArticle[] with excerpt populated.
 * Never throws — logs errors and returns [].
 */
export async function fetchTavilyNews(target: TickerInput): Promise<NormalizedArticle[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[Tavily] TAVILY_API_KEY is not set. Skipping Tavily provider. Get a free key at https://tavily.com");
    return [];
  }

  const query = buildQuery(target);
  const maxResults = parseInt(process.env.TAVILY_MAX_RESULTS || "10", 10);
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
      console.warn(`[Tavily] HTTP ${res.status} for "${target.name}" (query: "${query}"): ${errorText.slice(0, 200)}`);
      return [];
    }

    const data = await res.json();

    if (!data.results || !Array.isArray(data.results)) {
      console.warn(`[Tavily] No results array in response for "${target.name}"`);
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

    console.log(`[Tavily] Fetched ${articles.length} articles for "${target.name}" (query: "${query}")`);
    return articles;
  } catch (error: any) {
    console.error(`[Tavily] Network error for "${target.name}":`, error.message || error);
    return [];
  }
}
