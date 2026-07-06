import { config } from 'dotenv';
config();
import { getStartedBoss } from './src/lib/boss';
import { ingestNews } from './src/lib/pipeline';
import { prisma } from './src/lib/db';

async function startWorker() {
  console.log('[Worker] Starting pg-boss worker...');
  const boss = await getStartedBoss();

  const pipelineConcurrency = parseInt(process.env.PIPELINE_CONCURRENCY || "4", 10);
  console.log(`[Worker] Pulling jobs with concurrency limit: ${pipelineConcurrency}`);

  await boss.work('ingest-holding', { localConcurrency: pipelineConcurrency }, async (jobs) => {
    const jobList = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of jobList) {
      const { holdingId, skipHeavyApis = false, runEvaluation = true } = job.data as any;
      console.log(`[Worker] Received ingest job for holding: ${holdingId}`);

      try {
        const report = await ingestNews(undefined, runEvaluation, [holdingId], skipHeavyApis);
        const metrics = report.metrics;
        
        const holdingsProcessed = report.results.length;
        const findingsSaved = report.results.reduce((sum, r) => sum + r.findingsAdded, 0);
        const isQuotaExhausted = report.results.some(r => r.reason === 'LLM_QUOTA_EXHAUSTED');
        
        console.log(`[Worker] Finished ingest job for holding ${holdingId}. Saved ${findingsSaved} findings. Cost saved: ${metrics.cost.saved?.totalTokens || 0} tokens.`);
        
        // Save PipelineRun metric
        await prisma.pipelineRun.create({
          data: {
            startedAt: new Date(),
            durationMs: metrics.p50.relevance || 0, // Approx
            holdingsProcessed,
            findingsSaved,
            errorsJson: {},
            stageTimingsJson: metrics.stageTimings,
            p95Json: metrics.p95,
            costJson: metrics.cost,
          }
        });
        
        if (isQuotaExhausted) {
          console.warn(`[Worker] LLM Quota exhausted during job ${job.id}.`);
          throw new Error('LLM_QUOTA_EXHAUSTED');
        }

      } catch (err: any) {
        console.error(`[Worker] Job ${job.id} failed:`, err);
        throw err;
      }
    }
  });
  
  console.log('[Worker] Listening for jobs on "ingest-holding" queue...');
}

startWorker().catch(e => {
  console.error('[Worker] Fatal error:', e);
  process.exit(1);
});
