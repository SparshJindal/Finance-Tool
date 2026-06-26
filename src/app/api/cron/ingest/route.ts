import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ingestNews } from '@/lib/pipeline';

export const maxDuration = 300; // Vercel max duration for pro/hobby is typically 60s/300s
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchSize = parseInt(process.env.BATCH_SIZE || "5", 10);

  try {
    // Select the least recently ingested holdings
    // In PostgreSQL, ORDER BY ASC puts NULLs last by default.
    // However, Prisma doesn't currently support NULLS FIRST out of the box in orderBy.
    // To ensure nulls are processed first, we can do a raw query, or simply fetch nulls first.
    let holdings = await prisma.holding.findMany({
      where: { lastIngestedAt: null },
      take: batchSize,
      select: { id: true }
    });

    if (holdings.length < batchSize) {
      const moreHoldings = await prisma.holding.findMany({
        where: { lastIngestedAt: { not: null } },
        orderBy: { lastIngestedAt: 'asc' },
        take: batchSize - holdings.length,
        select: { id: true }
      });
      holdings = holdings.concat(moreHoldings);
    }

    if (holdings.length === 0) {
      return NextResponse.json({ success: true, message: 'No holdings found to process' });
    }

    const holdingIds = holdings.map(h => h.id);
    console.log(`[Cron] Starting batch ingest for ${holdingIds.length} holdings:`, holdingIds);

    // Run the pipeline for these specific holdings
    // (skipHeavyApis = false, runEvaluation = true)
    const result = await ingestNews(undefined, true, holdingIds, false);

    return NextResponse.json({ 
      success: true, 
      processedHoldings: holdingIds.length,
      report: result.report 
    });
  } catch (error: any) {
    console.error('[Cron] Error during ingest:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
