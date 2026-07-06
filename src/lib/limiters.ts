import pLimit from 'p-limit';

export const PIPELINE_CONCURRENCY = parseInt(process.env.PIPELINE_CONCURRENCY || "4", 10);
export const NEWS_CONCURRENCY = parseInt(process.env.NEWS_CONCURRENCY || "8", 10);
export const LLM_CONCURRENCY = parseInt(process.env.LLM_CONCURRENCY || "10", 10);

export const holdingLimiter = pLimit(PIPELINE_CONCURRENCY);
export const newsLimiter = pLimit(NEWS_CONCURRENCY);
export const llmLimiter = pLimit(LLM_CONCURRENCY);
