import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStartedBoss } from '@/lib/boss';

export const maxDuration = 300; // Vercel max duration
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchSize = parseInt(process.env.BATCH_SIZE || "5", 10);

  try {
    let holdings = await prisma.holding.findMany({
      where: { lastIngestedAt: null },
      take: batchSize,
      select: { id: true, ticker: true }
    });

    if (holdings.length < batchSize) {
      const moreHoldings = await prisma.holding.findMany({
        where: { lastIngestedAt: { not: null } },
        orderBy: { lastIngestedAt: 'asc' },
        take: batchSize - holdings.length,
        select: { id: true, ticker: true }
      });
      holdings = holdings.concat(moreHoldings);
    }

    if (holdings.length === 0) {
      return NextResponse.json({ success: true, message: 'No holdings found to process' });
    }

    console.log(`[Cron] Enqueueing ingest jobs for ${holdings.length} holdings.`);
    const boss = await getStartedBoss();

    const jobs = holdings.map(h => ({
      name: 'ingest-holding',
      data: { holdingId: h.id, runEvaluation: true, skipHeavyApis: false },
      options: { 
        retryLimit: 3, 
        retryDelay: 60, // 1 minute backoff 
        expireInSeconds: 300 // Max 5 mins execution 
      }
    }));

    await Promise.all(jobs.map(j => boss.send(j.name, j.data, j.options)));

    return NextResponse.json({ 
      success: true, 
      enqueuedHoldings: holdings.length,
      message: "Successfully pushed to pg-boss queue"
    });
  } catch (error: any) {
    console.error('[Cron] Error during enqueueing:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
