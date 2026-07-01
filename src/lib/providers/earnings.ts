import { Holding, EarningsEvent } from "@prisma/client";
import { getEarningsCalendar, getEarningsSurprises } from "./finnhub";
import { askAI, LlmQuotaExhaustedError } from "./ai";

export function isIndia(holding: Holding): boolean {
  const ex = holding.exchange?.toUpperCase() || "";
  if (ex === "NSE" || ex === "BSE") return true;
  if (holding.ticker.endsWith(".NS") || holding.ticker.endsWith(".BO")) return true;
  return false;
}

export async function fetchEarningsForHolding(holding: Holding): Promise<Partial<EarningsEvent>[]> {
  const events: Partial<EarningsEvent>[] = [];
  
  if (isIndia(holding)) {
    // Tavily + LLM fallback path for Indian stocks
    try {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) return [];
      
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: `"${holding.company}" quarterly results EPS revenue guidance`,
          search_depth: "basic",
          include_answer: false,
          max_results: 1,
          topic: "news",
        }),
      });
      
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.results || data.results.length === 0) return [];
      
      const article = data.results[0];
      
      const prompt = `
Extract the latest quarterly earnings figures from this news article about ${holding.company} (${holding.ticker}).
Article Content:
${article.content}

You must return a JSON object containing the extracted earnings data.
If any value is missing, omit it or return null.
`;
      const schema = {
        type: "OBJECT",
        properties: {
          reportDate: { type: "STRING", description: "ISO 8601 date format if available" },
          fiscalPeriod: { type: "STRING", description: "e.g. Q3 2024" },
          epsActual: { type: "NUMBER" },
          epsEstimate: { type: "NUMBER" },
          revenueActual: { type: "NUMBER" },
          revenueEstimate: { type: "NUMBER" },
          guidance: { type: "STRING" }
        }
      };
      
      const resultStr = await askAI({
        prompt,
        schema,
        preferredModel: "gemini-2.5-flash",
        temperature: 0.2
      });
      
      const extracted = JSON.parse(resultStr);
      if (extracted && (extracted.epsActual || extracted.revenueActual || extracted.reportDate)) {
        events.push({
          reportDate: extracted.reportDate ? new Date(extracted.reportDate) : new Date(),
          fiscalPeriod: extracted.fiscalPeriod,
          epsActual: extracted.epsActual,
          epsEstimate: extracted.epsEstimate,
          revenueActual: extracted.revenueActual,
          revenueEstimate: extracted.revenueEstimate,
          guidance: extracted.guidance,
          status: "REPORTED",
          source: "news",
        });
      }
    } catch (e) {
      if (e instanceof LlmQuotaExhaustedError) throw e;
      console.warn(`[fetchEarnings] Failed India fallback for ${holding.ticker}:`, e);
    }
  } else {
    // US / Finnhub path
    try {
      const today = new Date();
      const future = new Date();
      future.setDate(today.getDate() + 90);
      
      const calendar = await getEarningsCalendar(holding.ticker, today.toISOString(), future.toISOString());
      if (calendar && calendar.length > 0) {
        // Find next upcoming
        const upcoming = calendar.find(c => new Date(c.date) >= today);
        if (upcoming) {
          events.push({
            reportDate: new Date(upcoming.date),
            reportWhen: upcoming.hour,
            fiscalPeriod: upcoming.quarter && upcoming.year ? `Q${upcoming.quarter} ${upcoming.year}` : undefined,
            status: "UPCOMING",
            epsEstimate: upcoming.epsEstimate,
            revenueEstimate: upcoming.revenueEstimate,
            source: "finnhub"
          });
        }
      }
      
      // Get latest reported from surprises
      const surprises = await getEarningsSurprises(holding.ticker);
      if (surprises && surprises.length > 0) {
        // Assuming first is latest
        const latest = surprises[0];
        if (latest.actual || latest.estimate) {
          let rDate = new Date();
          // Let's try to find the date from calendar for the past 120 days
          const past = new Date();
          past.setDate(today.getDate() - 120);
          const pastCal = await getEarningsCalendar(holding.ticker, past.toISOString(), today.toISOString());
          const match = pastCal.find(c => c.quarter && c.year && latest.period.includes(`${c.year}`) && latest.period.includes(`Q${c.quarter}`));
          if (match && match.date) {
            rDate = new Date(match.date);
          }
          
          events.push({
            reportDate: rDate,
            fiscalPeriod: latest.period,
            status: "REPORTED",
            epsActual: latest.actual,
            epsEstimate: latest.estimate,
            epsSurprisePct: latest.surprisePercent,
            source: "finnhub"
          });
        }
      }
    } catch (e) {
      console.warn(`[fetchEarnings] Failed Finnhub path for ${holding.ticker}:`, e);
    }
  }
  
  return events;
}

export async function judgeEarningsVsThesis(holding: Holding, event: Partial<EarningsEvent>) {
  const prompt = `
Analyze this earnings report for ${holding.company} (${holding.ticker}) against the user's investment thesis.

Holding Thesis: "${holding.thesis}"
Direction Logic: ${holding.directionLogic} (If SHORT, a strong earnings beat THREATENS the thesis. If LONG, a strong beat SUPPORTS the thesis.)

Earnings Data:
Fiscal Period: ${event.fiscalPeriod || "Unknown"}
EPS Actual: ${event.epsActual} (Est: ${event.epsEstimate})
Revenue Actual: ${event.revenueActual} (Est: ${event.revenueEstimate})
Guidance: ${event.guidance || "None provided"}

Return a JSON object containing:
- verdict: strictly one of "SUPPORTS", "THREATENS", "MIXED", or "NEUTRAL".
- summary: a concise, <=25-word thesis-relative one-liner explaining the verdict.
`;

  const schema = {
    type: "OBJECT",
    properties: {
      verdict: { type: "STRING", enum: ["SUPPORTS", "THREATENS", "MIXED", "NEUTRAL"] },
      summary: { type: "STRING" }
    }
  };

  const resultStr = await askAI({
    prompt,
    schema,
    preferredModel: "gemini-2.5-flash",
    temperature: 0.2
  });

  const parsed = JSON.parse(resultStr);
  return {
    verdict: parsed.verdict,
    summary: parsed.summary
  };
}
