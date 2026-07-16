import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStartedBoss } from '@/lib/boss';
import stringSimilarity from 'string-similarity';

export const maxDuration = 300; // Vercel max duration
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all active holdings across all users
    const holdings = await prisma.holding.findMany({
      select: { id: true, ticker: true, thesis: true, directionLogic: true, kind: true }
    });

    if (holdings.length === 0) {
      return NextResponse.json({ success: true, message: 'No holdings found to process' });
    }

    // Group by Ticker
    const groupedByTicker: Record<string, typeof holdings> = {};
    for (const h of holdings) {
      if (!groupedByTicker[h.ticker]) groupedByTicker[h.ticker] = [];
      groupedByTicker[h.ticker].push(h);
    }

    const clusters: string[][] = [];

    // Cluster by Thesis & Direction within each Ticker group
    for (const group of Object.values(groupedByTicker)) {
      let unclustered = [...group];
      
      while (unclustered.length > 0) {
        const head = unclustered[0];
        const clusterHoldingIds = [head.id];
        const remaining = [];

        // Normalize direction for the cluster head
        const headDirection = [head.directionLogic, head.kind].map(v => (v || '').toString().toUpperCase().trim()).find(v => v === 'LONG' || v === 'SHORT') || 'LONG';

        for (let i = 1; i < unclustered.length; i++) {
          const candidate = unclustered[i];
          const candDirection = [candidate.directionLogic, candidate.kind].map(v => (v || '').toString().toUpperCase().trim()).find(v => v === 'LONG' || v === 'SHORT') || 'LONG';
          
          // Must have same direction to be clustered
          if (headDirection === candDirection) {
            const sim = stringSimilarity.compareTwoStrings(
              (head.thesis || '').toLowerCase(),
              (candidate.thesis || '').toLowerCase()
            );
            
            if (sim >= 0.70) {
              clusterHoldingIds.push(candidate.id);
            } else {
              remaining.push(candidate);
            }
          } else {
            remaining.push(candidate);
          }
        }
        
        clusters.push(clusterHoldingIds);
        unclustered = remaining;
      }
    }

    console.log(`[Cron] Clustered ${holdings.length} holdings into ${clusters.length} cross-account jobs.`);
    const boss = await getStartedBoss();

    const jobs = clusters.map(clusterIds => ({
      name: 'ingest-cluster',
      data: { targetHoldingIds: clusterIds, runEvaluation: true, skipHeavyApis: false },
      options: { 
        retryLimit: 3, 
        retryDelay: 60, // 1 minute backoff 
        expireInSeconds: 300 // Max 5 mins execution 
      }
    }));

    await Promise.all(jobs.map(j => boss.send(j.name, j.data, j.options)));

    return NextResponse.json({ 
      success: true, 
      enqueuedClusters: clusters.length,
      originalHoldingsCount: holdings.length,
      message: "Successfully pushed clustered jobs to pg-boss queue"
    });
  } catch (error: any) {
    console.error('[Cron] Error during enqueueing:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
