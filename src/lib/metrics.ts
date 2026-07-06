import { AsyncLocalStorage } from 'node:async_hooks';

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export class MetricsCollector {
  public stageTimings: Record<string, number[]> = {};
  public providerCalls: Record<string, { ok: number; failed: number }> = {};
  public llmCost: Record<string, LlmUsage> = {};

  public cacheHits: number = 0;
  public cacheMisses: number = 0;

  addTiming(stage: string, durationMs: number) {
    if (!this.stageTimings[stage]) {
      this.stageTimings[stage] = [];
    }
    this.stageTimings[stage].push(durationMs);
  }

  addCacheHit() { this.cacheHits++; }
  addCacheMiss() { this.cacheMisses++; }

  addProviderCall(provider: string, success: boolean) {
    if (!this.providerCalls[provider]) {
      this.providerCalls[provider] = { ok: 0, failed: 0 };
    }
    if (success) {
      this.providerCalls[provider].ok++;
    } else {
      this.providerCalls[provider].failed++;
    }
  }

  addLlmCall(model: string, usage?: LlmUsage | null) {
    if (!usage) return;
    if (!this.llmCost[model]) {
      this.llmCost[model] = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }
    this.llmCost[model].promptTokens += usage.promptTokens;
    this.llmCost[model].completionTokens += usage.completionTokens;
    this.llmCost[model].totalTokens += usage.totalTokens;
  }

  getStageP95(stage: string): number {
    const timings = this.stageTimings[stage];
    if (!timings || timings.length === 0) return 0;
    const sorted = [...timings].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[index];
  }

  getStageP50(stage: string): number {
    const timings = this.stageTimings[stage];
    if (!timings || timings.length === 0) return 0;
    const sorted = [...timings].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.50) - 1;
    return sorted[index];
  }

  toJSON() {
    const p95Json: Record<string, number> = {};
    const p50Json: Record<string, number> = {};
    for (const stage of Object.keys(this.stageTimings)) {
      p95Json[stage] = this.getStageP95(stage);
      p50Json[stage] = this.getStageP50(stage);
    }
    const cacheHitRate = (this.cacheHits + this.cacheMisses > 0) 
      ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) 
      : 0;
    return {
      stageTimings: this.stageTimings,
      p95: p95Json,
      p50: p50Json,
      providerCalls: this.providerCalls,
      cost: this.llmCost,
      cache: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: cacheHitRate
      }
    };
  }
}

export const metricsStorage = new AsyncLocalStorage<MetricsCollector>();

export async function withTiming<T>(stage: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const collector = metricsStorage.getStore();
  let success = true;
  try {
    return await fn();
  } catch (err) {
    success = false;
    throw err;
  } finally {
    const duration = Date.now() - start;
    if (collector) {
      collector.addTiming(stage, duration);
      // Since some stages might map directly to providers, we can also record a generic provider call if needed.
      // E.g., 'fetch' -> news provider. We'll track specific ones via addProviderCall when relevant.
    }
  }
}
