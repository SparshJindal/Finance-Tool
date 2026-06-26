import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

export async function askAI({
  prompt,
  schema,
  preferredModel = "gemini-2.5-flash",
  temperature = 0.2
}: {
  prompt: string;
  schema?: any;
  preferredModel?: string;
  temperature?: number;
}) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const attemptGemini = async () => {
    const config: any = { temperature };
    if (schema) {
      config.responseMimeType = "application/json";
      config.responseSchema = schema;
    }
    const response = await ai.models.generateContent({
      model: preferredModel,
      contents: prompt,
      config,
    });
    if (!response.text) throw new Error("Gemini returned empty text");
    return response.text;
  };

  try {
    const res = await attemptGemini();
    console.log(`[askAI] Successfully served by Gemini (${preferredModel}) on first attempt.`);
    return res;
  } catch (error: any) {
    const errString = String(error.message || error);
    if (error.status === 429 || errString.includes("429") || errString.includes("RESOURCE_EXHAUSTED")) {
      console.warn(`[askAI] Gemini 429 rate limit hit. Parsing retry delay...`);
      
      let delayMs = 60000; // default 60s fallback
      const delayMatch = errString.match(/"retryDelay":"(\d+)s"/);
      if (delayMatch && delayMatch[1]) {
        delayMs = parseInt(delayMatch[1], 10) * 1000 + 1000; // parse seconds, add 1s buffer
      }

      console.log(`[askAI] Waiting for ${delayMs}ms before retrying Gemini...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      try {
        const res = await attemptGemini();
        console.log(`[askAI] Successfully served by Gemini (${preferredModel}) on retry.`);
        return res;
      } catch (retryError: any) {
        console.error(`[askAI] Gemini retry failed. Falling back to Groq.`);
      }
    } else {
      console.error(`[askAI] Gemini failed with non-429 error. Falling back to Groq. Error:`, error);
    }
  }

  // Fallback to Groq
  console.log(`[askAI] Attempting Groq fallback (llama3-70b-8192)...`);
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) throw new Error("GROQ_API_KEY is not set for fallback");

  const groq = new Groq({ apiKey: groqKey });
  
  // Groq requires an explicit instruction for JSON object mode
  const fallbackPrompt = schema 
    ? `${prompt}\n\nIMPORTANT: You must return the output as a valid JSON object exactly matching this JSON Schema structure:\n${JSON.stringify(schema, null, 2)}\n\nDo not return a naked JSON array. It must be a JSON object containing the specified keys.`
    : prompt;

  const chatCompletion = await groq.chat.completions.create({
    messages: [{ role: "user", content: fallbackPrompt }],
    model: "llama-3.3-70b-versatile",
    temperature,
    response_format: schema ? { type: "json_object" } : undefined,
  });

  let content = chatCompletion.choices[0]?.message?.content;
  if (!content) throw new Error("Groq returned empty text");

  // Clean markdown block if present
  if (schema) {
    content = content.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
  }

  console.log(`[askAI] Successfully served by Groq fallback.`);
  return content;
}

/**
 * Typed error for embedding rate-limit failures.
 * The gate (and callers) can catch this specifically and skip/continue
 * rather than letting the whole pipeline abort.
 */
export class EmbeddingRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingRateLimitError";
  }
}

export async function embedText(text: string): Promise<number[]> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const primaryModel = process.env.EMBEDDING_MODEL || "gemini-embedding-001";

  const attemptEmbed = async (modelName: string) => {
    const response = await ai.models.embedContent({
      model: modelName,
      contents: text,
    });
    if (!response.embeddings || !response.embeddings[0]?.values) {
      throw new Error(`Gemini returned empty embeddings for ${modelName}`);
    }
    return response.embeddings[0].values;
  };

  try {
    return await attemptEmbed(primaryModel);
  } catch (error: any) {
    const errString = String(error.message || error);
    if (error.status === 429 || error.status === 503 || errString.includes("429") || errString.includes("503") || errString.includes("RESOURCE_EXHAUSTED") || errString.includes("UNAVAILABLE")) {
      // ONE short retry (5s) instead of blocking for 60s
      console.warn(`[embedText] Rate limit / 503 hit. Retrying in 5s...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        return await attemptEmbed(primaryModel);
      } catch (retryError: any) {
        // Throw a typed error so callers (gate.ts) can catch and skip
        throw new EmbeddingRateLimitError(
          `[embedText] Retry failed for model ${primaryModel}: ${retryError.message || retryError}`
        );
      }
    }
    
    // Fallback to text-embedding-004 if the primary model fails
    console.warn(`[embedText] Error with ${primaryModel}. Falling back to text-embedding-004...`);
    try {
      return await attemptEmbed("text-embedding-004");
    } catch (fallbackError) {
      throw error; // Throw the original error if fallback also fails
    }
  }
}
