import { config } from 'dotenv';
config();
import { getStartedBoss } from './src/lib/boss';
import { ingestNews } from './src/lib/pipeline';
import { prisma } from './src/lib/db';
import { evaluateFalsifier } from './src/lib/falsifier-agent';

async function startWorker() {
  console.log('[Worker] Starting pg-boss worker...');
  const boss = await getStartedBoss();

  const pipelineConcurrency = parseInt(process.env.PIPELINE_CONCURRENCY || "4", 10);
  console.log(`[Worker] Pulling jobs with concurrency limit: ${pipelineConcurrency}`);

  // Support both legacy ingest-holding and new ingest-cluster jobs
  const handleJob = async (jobs: any) => {
    const jobList = Array.isArray(jobs) ? jobs : [jobs];
    for (const job of jobList) {
      const { holdingId, targetHoldingIds, skipHeavyApis = false, runEvaluation = true } = job.data as any;
      const idsToProcess = targetHoldingIds || (holdingId ? [holdingId] : []);
      
      console.log(`[Worker] Received ingest job for ${idsToProcess.length} holdings: ${idsToProcess.join(', ')}`);

      try {
        const report = await ingestNews(undefined, runEvaluation, idsToProcess, skipHeavyApis);
        const metrics = report.metrics;
        
        const holdingsProcessed = report.results.length;
        const findingsSaved = report.results.reduce((sum, r) => sum + r.findingsAdded, 0);
        const isQuotaExhausted = report.results.some(r => r.reason === 'LLM_QUOTA_EXHAUSTED');
        
        console.log(`[Worker] Finished ingest job for cluster. Saved ${findingsSaved} findings. Cost saved: ${metrics.cost.saved?.totalTokens || 0} tokens.`);
        
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
  };

  // Handler for eval-falsifier
  const handleFalsifierJob = async (job: any) => {
    const { falsifierId, holdingId, ticker, company, thesis, text, rationale } = job.data as any;
    console.log(`[Worker] Received eval-falsifier job for ${ticker}: ${text}`);
    try {
      await evaluateFalsifier(falsifierId, holdingId, ticker, company, thesis, text, rationale);
    } catch (err) {
      console.error(`[Worker] Job ${job.id} failed:`, err);
      throw err;
    }
  };

  await boss.work('ingest-holding', { localConcurrency: pipelineConcurrency }, handleJob);
  await boss.work('ingest-cluster', { localConcurrency: pipelineConcurrency }, handleJob);
  await boss.work('eval-falsifier', { localConcurrency: pipelineConcurrency }, handleFalsifierJob);
  
  console.log('[Worker] Listening for jobs on "ingest-holding", "ingest-cluster", and "eval-falsifier" queues...');
}

startWorker().catch(e => {
  console.error('[Worker] Fatal error:', e);
  process.exit(1);
});
