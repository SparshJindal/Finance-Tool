import { Type } from "@google/genai";
import { askAI } from "./ai";

const singleResponseSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            description: "Must be exactly one of: 'disruption', 'competitor', 'geopolitical', or 'signal'",
          },
          text: {
            type: Type.STRING,
            description: "The specific watch-question.",
          },
        },
        required: ["category", "text"],
      }
    }
  },
  required: ["questions"]
};

const batchResponseSchema = {
  type: Type.OBJECT,
  properties: {
    results: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ticker: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                text: { type: Type.STRING }
              },
              required: ["category", "text"]
            }
          }
        },
        required: ["ticker", "questions"]
      }
    }
  },
  required: ["results"]
};

export async function generateWatchQuestions(
  company: string,
  thesis: string,
  sector: string,
  competitors: string[]
) {
  const prompt = `
    You are an expert financial analyst. 
    Company: ${company}
    Sector: ${sector}
    Thesis: ${thesis}
    Key Competitors: ${competitors.join(", ")}

    Generate 4 to 6 specific, highly relevant watch-questions across these categories: 'disruption', 'competitor', 'geopolitical', and 'signal'.
    These questions should identify what a portfolio manager must monitor to validate or invalidate the investment thesis.
  `;

  const responseText = await askAI({
    prompt,
    schema: singleResponseSchema,
    preferredModel: "gemini-2.5-flash",
  });

  const parsed = JSON.parse(responseText);
  return parsed.questions as { category: string; text: string }[];
}

export async function batchGenerateWatchQuestions(
  holdingsData: Array<{ ticker: string; company: string; thesis: string; sector: string; competitors: string[] }>
) {
  const contextString = holdingsData.map(h => `
    Ticker: ${h.ticker}
    Company: ${h.company}
    Sector: ${h.sector}
    Thesis: ${h.thesis}
    Key Competitors: ${h.competitors.join(", ")}
  `).join("\n\n---\n\n");

  const prompt = `
    You are an expert financial analyst overseeing a portfolio of multiple holdings.
    Below is the context for several companies in the portfolio:

    ${contextString}

    For EACH company, generate 4 to 6 specific, highly relevant watch-questions across these categories: 'disruption', 'competitor', 'geopolitical', and 'signal'.
    These questions should identify what a portfolio manager must monitor to validate or invalidate the specific investment thesis for that company.
  `;

  const responseText = await askAI({
    prompt,
    schema: batchResponseSchema,
    preferredModel: "gemini-2.5-flash",
  });

  const parsed = JSON.parse(responseText);
  return parsed.results as { ticker: string, questions: { category: string; text: string }[] }[];
}
