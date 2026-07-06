import { config } from 'dotenv';
config();
import { getStartedBoss } from '../src/lib/boss';
import { prisma } from '../src/lib/db';

async function runLoadTest() {
  console.log('[LoadTest] Starting load generation...');
  const boss = await getStartedBoss();
  
  let holding = await prisma.holding.findFirst();
  if (!holding) {
    // Create a mock user
    const user = await prisma.user.upsert({
      where: { email: 'loadtest@example.com' },
      update: {},
      create: { email: 'loadtest@example.com', name: 'Load Tester' }
    });
    
    // Create a mock holding
    holding = await prisma.holding.create({
      data: {
        userId: user.id,
        ticker: 'TSLA',
        company: 'Tesla',
        exchange: 'US',
        kind: 'LONG',
        thesis: 'Test load thesis',
        directionLogic: 'Test direction logic'
      }
    });
  }

  const jobsToQueue = parseInt(process.argv[2] || '50', 10);
  
  console.log(`[LoadTest] Enqueueing ${jobsToQueue} jobs for holding ${holding.ticker}...`);
  
  const jobs = Array.from({ length: jobsToQueue }).map((_, i) => ({
    name: 'ingest-holding',
    data: { holdingId: holding.id, runEvaluation: false, skipHeavyApis: true }, // We test DB/Queue throughput mainly, skipping heavy API avoids rate limit
    options: { retryLimit: 0, expireInSeconds: 60 }
  }));

  const start = Date.now();
  await Promise.all(jobs.map(j => boss.send(j.name, j.data, j.options)));
  console.log(`[LoadTest] Enqueued ${jobsToQueue} jobs in ${Date.now() - start}ms.`);
  
  console.log('[LoadTest] Monitoring queue completion. Make sure `npm run worker` is running!');
  
  // Wait for queue to empty
  const pollStart = Date.now();
  
  while (true) {
    const res: any[] = await prisma.$queryRaw`SELECT count(*) FROM pgboss.job WHERE name = 'ingest-holding' AND state IN ('created', 'retry', 'active')`;
    const remaining = Number(res[0].count);
    
    if (remaining === 0) {
      break;
    }
    
    console.log(`[LoadTest] ${remaining} jobs remaining...`);
    await new Promise(r => setTimeout(r, 2000));
  }
  
  const duration = (Date.now() - pollStart) / 1000;
  console.log(`[LoadTest] Queue drained in ${duration.toFixed(2)}s.`);
  console.log(`[LoadTest] Sustained throughput: ${(jobsToQueue / duration).toFixed(2)} jobs/sec.`);
  
  process.exit(0);
}

runLoadTest().catch(e => {
  console.error('[LoadTest] Error:', e);
  process.exit(1);
});
