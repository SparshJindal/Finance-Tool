import { getNews } from '../src/lib/providers/news';
import { prisma } from '../src/lib/db';

async function verify() {
  console.log("Starting verification...");
  
  // Clean up existing logs for NVDA to ensure we bypass cache
  await prisma.newsFetchLog.deleteMany({
    where: { ticker: 'NVDA' }
  });

  const targets = [{ symbol: 'NVDA', name: 'Nvidia', exchange: 'US' }];
  
  const articles = await getNews(targets, false);
  console.log(`Verification Complete. Articles fetched: ${articles.length}`);
}

verify().catch(console.error).finally(() => process.exit(0));
