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
  const llmPrimary = process.env.LLM_PRIMARY || "groq";

  const attemptGemini = async () => {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("GEMINI_API_KEY is not set");
    const ai = new GoogleGenAI({ apiKey: geminiKey });
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

  const attemptGroq = async () => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error("GROQ_API_KEY is not set for Groq");
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

    return content;
  };

  if (llmPrimary === "groq") {
    try {
      console.log(`[askAI] Attempting Groq primary (llama-3.3-70b-versatile)...`);
      const res = await attemptGroq();
      console.log(`[askAI] Successfully served by Groq primary.`);
      return res;
    } catch (error: any) {
      console.error(`[askAI] Groq primary failed. Falling back to Gemini. Error:`, error.message || error);
      try {
        console.log(`[askAI] Attempting Gemini fallback (${preferredModel})...`);
        const res = await attemptGemini();
        console.log(`[askAI] Successfully served by Gemini fallback.`);
        return res;
      } catch (geminiError: any) {
         console.error(`[askAI] Gemini fallback failed:`, geminiError.message || geminiError);
         throw geminiError;
      }
    }
  } else {
    // Current Gemini-first behavior
    try {
      console.log(`[askAI] Attempting Gemini primary (${preferredModel})...`);
      const res = await attemptGemini();
      console.log(`[askAI] Successfully served by Gemini (${preferredModel}) on first attempt.`);
      return res;
    } catch (error: any) {
      const errString = String(error.message || error);
      if (error.status === 429 || errString.includes("429") || errString.includes("RESOURCE_EXHAUSTED")) {
        console.warn(`[askAI] Gemini 429 rate limit hit. Parsing retry delay...`);
        let delayMs = 60000;
        const delayMatch = errString.match(/"retryDelay":"(\d+)s"/);
        if (delayMatch && delayMatch[1]) {
          delayMs = parseInt(delayMatch[1], 10) * 1000 + 1000;
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
    console.log(`[askAI] Attempting Groq fallback (llama-3.3-70b-versatile)...`);
    const res = await attemptGroq();
    console.log(`[askAI] Successfully served by Groq fallback.`);
    return res;
  }
}

