import type { Comparison } from '@agent-evals/shared';

interface ScoredRun { taskId: string; configId: string; repetition: number; score: number }

export function compareRuns(runs: ScoredRun[], baselineId: string, candidateId: string): Comparison {
  const baseline = runs.filter((run) => run.configId === baselineId);
  const candidateMap = new Map(runs.filter((run) => run.configId === candidateId).map((run) => [`${run.taskId}:${run.repetition}`, run.score]));
  const pairs = baseline.flatMap((run) => {
    const candidate = candidateMap.get(`${run.taskId}:${run.repetition}`);
    return candidate === undefined ? [] : [{ taskId: run.taskId, baseline: run.score, candidate, delta: candidate - run.score }];
  });
  if (!pairs.length) return emptyComparison();

  const baselineMean = mean(pairs.map((pair) => pair.baseline));
  const candidateMean = mean(pairs.map((pair) => pair.candidate));
  const deltas = pairs.map((pair) => pair.delta);
  const samples = bootstrapMeans(deltas, 10_000, 917_421);
  samples.sort((a, b) => a - b);
  const low = percentile(samples, 0.025);
  const high = percentile(samples, 0.975);
  const byTask = [...new Set(pairs.map((pair) => pair.taskId))].map((taskId) => {
    const taskPairs = pairs.filter((pair) => pair.taskId === taskId);
    const base = mean(taskPairs.map((pair) => pair.baseline));
    const cand = mean(taskPairs.map((pair) => pair.candidate));
    return { taskId, baseline: base, candidate: cand, delta: cand - base };
  });
  return {
    baselineMean, candidateMean, absoluteDelta: candidateMean - baselineMean,
    relativeDelta: baselineMean === 0 ? null : (candidateMean - baselineMean) / baselineMean,
    confidenceInterval: [low, high], confidenceLevel: 0.95,
    probabilityOfImprovement: samples.filter((value) => value > 0).length / samples.length,
    verdict: low > 0 ? 'better' : high < 0 ? 'worse' : 'inconclusive', sampleCount: pairs.length, byTask,
  };
}

function mean(values: number[]) { return values.reduce((total, value) => total + value, 0) / values.length; }
function percentile(sorted: number[], p: number) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))]; }
function bootstrapMeans(values: number[], count: number, seed: number) {
  let state = seed >>> 0;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 2 ** 32; };
  return Array.from({ length: count }, () => mean(Array.from({ length: values.length }, () => values[Math.floor(random() * values.length)])));
}
function emptyComparison(): Comparison { return { baselineMean: 0, candidateMean: 0, absoluteDelta: 0, relativeDelta: null, confidenceInterval: [0, 0], confidenceLevel: .95, probabilityOfImprovement: 0, verdict: 'inconclusive', sampleCount: 0, byTask: [] }; }
