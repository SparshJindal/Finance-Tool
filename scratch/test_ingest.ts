import { ingestNews } from '../src/lib/pipeline';
import { prisma } from '../src/lib/db';

async function test() {
  console.log("Starting test ingest...");
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user found");
    return;
  }
  
  try {
    await ingestNews(user.id);
    console.log("Ingest completed");
  } catch (e) {
    console.error("Ingest failed:", e);
  }
}

test().catch(console.error).finally(() => process.exit(0));
