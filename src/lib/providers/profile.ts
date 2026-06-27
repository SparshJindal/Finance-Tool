import { askAI } from './ai';
import { Type } from '@google/genai';

export interface HoldingProfileParams {
  ticker: string;
  company: string;
  thesis: string;
  directionLogic: string;
}

export interface HoldingProfileResult {
  aliases: string[];
  themes: string[];
  competitors: { ticker?: string; name: string }[];
  thesis: string;
  directionLogic: string;
}

export async function generateHoldingProfile(params: HoldingProfileParams): Promise<HoldingProfileResult> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      aliases: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Alternative names the company is frequently called in the press (e.g., 'Google' for 'Alphabet', acronyms, short names). Used for news search disambiguation."
      },
      themes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3-5 industry/sector concept phrases central to the investment thesis. Examples for NVDA: 'AI accelerators', 'data-center capex', 'semiconductor supply chain'. Do NOT include company names, ticker symbols, or aliases. Keep them short for search queries."
      },
      competitors: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            ticker: { type: Type.STRING, description: "The stock ticker symbol if public, omit if private." },
            name: { type: Type.STRING, description: "The name of the competitor company." }
          },
          required: ["name"]
        },
        description: "2-5 direct competitors to the company in its main sectors."
      },
      thesis: {
        type: Type.STRING,
        description: "A concise 2-3 sentence investment thesis explaining why one would hold this stock based on its fundamentals, moats, and market position."
      },
      directionLogic: {
        type: Type.STRING,
        description: "The primary stance or position logic (LONG or SHORT). Default to LONG for typical investments."
      }
    },
    required: ["aliases", "themes", "competitors", "thesis", "directionLogic"]
  };

  const prompt = `
    Analyze the following company and investment thesis to build a search profile.
    Company: ${params.company} (${params.ticker})
    Direction/Stance: ${params.directionLogic}
    Investment Thesis: ${params.thesis}

    Return a JSON object containing:
    1. aliases: Alternative names for the company in news articles (press names, acronyms, short names). Do NOT include the full official company name or ticker symbol.
    2. themes: 3-5 key industry/sector concept phrases describing the core technologies, sectors, or macro forces relevant to the thesis (e.g. "cloud computing", "interest rate sensitivity", "electric vehicle adoption"). These must be INDUSTRY CONCEPTS, not company names or aliases. Keep them short for use as search queries.
    3. competitors: 2-5 direct competitors that operate in the same space.
    4. thesis: A concise 2-3 sentence investment thesis for the company. Use the provided thesis if present, otherwise generate a fresh, accurate one based on the company and sector.
    5. directionLogic: Either "LONG" or "SHORT". Use the provided direction if present and valid, otherwise default to "LONG".
  `;

  try {
    const aiRes = await askAI({
      prompt,
      schema,
      preferredModel: 'gemini-2.5-flash',
      temperature: 0.3
    });

    const parsed = JSON.parse(aiRes);
    return {
      aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [],
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      competitors: Array.isArray(parsed.competitors) ? parsed.competitors : [],
      thesis: typeof parsed.thesis === 'string' ? parsed.thesis : '',
      directionLogic: typeof parsed.directionLogic === 'string' ? parsed.directionLogic : 'LONG'
    };
  } catch (e) {
    console.error(`[generateHoldingProfile] Error generating profile for ${params.ticker}:`, e);
    return { aliases: [], themes: [], competitors: [], thesis: '', directionLogic: 'LONG' };
  }
}
