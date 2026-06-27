import { ingestNews } from "./src/lib/pipeline";
import { prisma } from "./src/lib/db";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  const sbin = await prisma.holding.findFirst({ where: { ticker: 'SBIN.NS' } });
  const itc = await prisma.holding.findFirst({ where: { ticker: 'ITC.NS' } });
  
  const targetIds: string[] = [];
  if (sbin) targetIds.push(sbin.id);
  if (itc) targetIds.push(itc.id);

  if (targetIds.length > 0) {
    console.log("Running ingestion for:", targetIds);
    await ingestNews(undefined, false, targetIds, false);
  } else {
    console.log("Holdings not found in DB.");
  }
}

run().catch(console.error).finally(() => process.exit(0));
