import { prisma } from '../src/lib/db';
import stringSimilarity from 'string-similarity';

async function main() {
  const holdings = await prisma.holding.findMany({
    select: { id: true, ticker: true, thesis: true, directionLogic: true, kind: true }
  });

  console.log(`Fetched ${holdings.length} total holdings.`);

  const groupedByTicker: Record<string, typeof holdings> = {};
  for (const h of holdings) {
    if (!groupedByTicker[h.ticker]) groupedByTicker[h.ticker] = [];
    groupedByTicker[h.ticker].push(h);
  }

  const clusters: string[][] = [];

  for (const group of Object.values(groupedByTicker)) {
    let unclustered = [...group];
    
    while (unclustered.length > 0) {
      const head = unclustered[0];
      const clusterHoldingIds = [head.id];
      const remaining = [];

      const headDirection = [head.directionLogic, head.kind].map(v => (v || '').toString().toUpperCase().trim()).find(v => v === 'LONG' || v === 'SHORT') || 'LONG';

      for (let i = 1; i < unclustered.length; i++) {
        const candidate = unclustered[i];
        const candDirection = [candidate.directionLogic, candidate.kind].map(v => (v || '').toString().toUpperCase().trim()).find(v => v === 'LONG' || v === 'SHORT') || 'LONG';
        
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

  console.log(`Clustered into ${clusters.length} cross-account jobs.`);
  console.log(JSON.stringify(clusters, null, 2));
}

main().catch(console.error);
