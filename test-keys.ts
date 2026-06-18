import { GoogleGenAI } from "@google/genai";
import { Resend } from "resend";
import 'dotenv/config';

async function testKeys() {
  console.log("=== API Health Check ===");

  // 1. Test Gemini Embeddings
  console.log("\\nTesting Gemini Embeddings...");
  if (!process.env.GEMINI_API_KEY) {
    console.log("❌ GEMINI_API_KEY is missing");
  } else {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const modelsResponse = await ai.models.list();
      const embeddingModels = [];
      for await (const model of modelsResponse) {
        if (model.name?.includes("embed") || model.name?.includes("embedding")) {
          embeddingModels.push(model.name);
        }
      }
      console.log("Available embedding models:", embeddingModels);
    } catch (e: any) {
      console.log("❌ listModels failed:", e.message);
    }
  }

  // 2. Test Resend
  console.log("\\nTesting Resend Configuration...");
  if (!process.env.RESEND_API_KEY) {
    console.log("❌ RESEND_API_KEY is missing");
  } else if (!process.env.DIGEST_EMAIL) {
    console.log("❌ DIGEST_EMAIL is missing");
  } else {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data, error } = await resend.emails.send({
        from: 'Disruption Radar <onboarding@resend.dev>',
        to: process.env.DIGEST_EMAIL,
        subject: 'Health Check',
        html: '<p>Test</p>',
      });
      if (error) {
        console.log("❌ Resend failed:", error.message);
      } else {
        console.log("✅ Resend is working! Email sent:", data?.id);
      }
    } catch (e: any) {
      console.log("❌ Resend exception:", e.message);
    }
  }

  console.log("\\n=== Health Check Complete ===");
}

testKeys();
