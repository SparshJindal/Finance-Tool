import { ingestNews } from "./src/lib/pipeline";
import { prisma } from "./src/lib/db";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  process.env.NEWS_MOCK = "true";
  process.env.NEWS_PROVIDERS = "gdelt,finnhub,marketaux";
  
  console.log("--- RUN 1: Fetching (Mock Mode) ---");
  const res1 = await ingestNews(undefined, false);
  console.log(`Run 1 returned ${res1.candidates?.length} candidates.`);
  
  console.log("\n--- RUN 2: Fetching Again (Should hit TTL cache) ---");
  const res2 = await ingestNews(undefined, false);
  console.log(`Run 2 returned ${res2.candidates?.length} candidates.`);
}

run().catch(console.error).finally(() => process.exit(0));
