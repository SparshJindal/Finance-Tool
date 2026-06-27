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

  const attemptOpenRouter = async () => {
    const orKey = process.env.OPENROUTER_API_KEY;
    if (!orKey) throw new Error("OPENROUTER_API_KEY is not set for OpenRouter");
    
    const fallbackPrompt = schema 
      ? `${prompt}\n\nIMPORTANT: You must return the output as a valid JSON object exactly matching this JSON Schema structure:\n${JSON.stringify(schema, null, 2)}\n\nDo not return a naked JSON array. It must be a JSON object containing the specified keys.`
      : prompt;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${orKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct:free",
        messages: [{ role: "user", content: fallbackPrompt }],
        temperature,
        response_format: schema ? { type: "json_object" } : undefined,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter HTTP error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned empty text");

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
      console.error(`[askAI] Groq primary failed. Falling back to OpenRouter. Error:`, error.message || error);
      try {
        if (!process.env.OPENROUTER_API_KEY) {
          throw new Error("OPENROUTER_API_KEY is not set, skipping OpenRouter");
        }
        console.log(`[askAI] Attempting OpenRouter fallback (meta-llama/llama-3.3-70b-instruct:free)...`);
        const res = await attemptOpenRouter();
        console.log(`[askAI] Successfully served by OpenRouter fallback.`);
        return res;
      } catch (orError: any) {
        console.error(`[askAI] OpenRouter fallback failed. Falling back to Gemini. Error:`, orError.message || orError);
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
        console.warn(`[askAI] Gemini 429 rate limit hit. Falling back to Groq immediately.`);
      } else {
        console.error(`[askAI] Gemini failed with non-429 error. Falling back to Groq. Error:`, error);
      }
    }

    // Fallback to Groq
    try {
      console.log(`[askAI] Attempting Groq fallback (llama-3.3-70b-versatile)...`);
      const res = await attemptGroq();
      console.log(`[askAI] Successfully served by Groq fallback.`);
      return res;
    } catch (groqFallbackErr: any) {
      console.error(`[askAI] Groq fallback failed. Falling back to OpenRouter. Error:`, groqFallbackErr.message || groqFallbackErr);
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is not set, skipping OpenRouter and failing completely");
      }
      console.log(`[askAI] Attempting OpenRouter fallback (meta-llama/llama-3.3-70b-instruct:free)...`);
      const res = await attemptOpenRouter();
      console.log(`[askAI] Successfully served by OpenRouter fallback.`);
      return res;
    }
  }
}

