import type { Comparison } from '@agent-evals/shared';

interface ScoredRun {
  taskId: string;
  configId: string;
  repetition: number;
  score: number;
}

interface PairedScore {
  taskId: string;
  baseline: number;
  candidate: number;
  delta: number;
}

const BOOTSTRAP_SAMPLES = 10_000;
const BOOTSTRAP_SEED = 917_421;

export function compareRuns(runs: ScoredRun[], baselineId: string, candidateId: string): Comparison {
  const pairs = pairRuns(runs, baselineId, candidateId);
  if (pairs.length === 0) return emptyComparison();

  const baselineMean = mean(pairs.map(({ baseline }) => baseline));
  const candidateMean = mean(pairs.map(({ candidate }) => candidate));
  const samples = bootstrapMeans(
    pairs.map(({ delta }) => delta),
    BOOTSTRAP_SAMPLES,
    BOOTSTRAP_SEED,
  ).sort((a, b) => a - b);
  const confidenceInterval: [number, number] = [percentile(samples, 0.025), percentile(samples, 0.975)];

  return {
    baselineMean,
    candidateMean,
    absoluteDelta: candidateMean - baselineMean,
    relativeDelta: baselineMean === 0 ? null : (candidateMean - baselineMean) / baselineMean,
    confidenceInterval,
    confidenceLevel: 0.95,
    probabilityOfImprovement: samples.filter((value) => value > 0).length / samples.length,
    verdict: confidenceInterval[0] > 0 ? 'better' : confidenceInterval[1] < 0 ? 'worse' : 'inconclusive',
    sampleCount: pairs.length,
    byTask: summarizeTasks(pairs),
  };
}

function pairRuns(runs: ScoredRun[], baselineId: string, candidateId: string): PairedScore[] {
  const candidateScores = new Map(
    runs.filter(({ configId }) => configId === candidateId).map((run) => [pairKey(run), run.score]),
  );
  return runs
    .filter(({ configId }) => configId === baselineId)
    .flatMap((run) => {
      const candidate = candidateScores.get(pairKey(run));
      return candidate === undefined
        ? []
        : [
            {
              taskId: run.taskId,
              baseline: run.score,
              candidate,
              delta: candidate - run.score,
            },
          ];
    });
}

function summarizeTasks(pairs: PairedScore[]) {
  return [...new Set(pairs.map(({ taskId }) => taskId))].map((taskId) => {
    const taskPairs = pairs.filter((pair) => pair.taskId === taskId);
    const baseline = mean(taskPairs.map((pair) => pair.baseline));
    const candidate = mean(taskPairs.map((pair) => pair.candidate));
    return { taskId, baseline, candidate, delta: candidate - baseline };
  });
}

function pairKey(run: Pick<ScoredRun, 'taskId' | 'repetition'>) {
  return `${run.taskId}:${run.repetition}`;
}

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(sorted: number[], probability: number) {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(probability * sorted.length)));
  return sorted[index];
}

function bootstrapMeans(values: number[], count: number, seed: number) {
  let state = seed >>> 0;
  const random = () => {
    state = (1_664_525 * state + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
  return Array.from({ length: count }, () =>
    mean(Array.from({ length: values.length }, () => values[Math.floor(random() * values.length)])),
  );
}

function emptyComparison(): Comparison {
  return {
    baselineMean: 0,
    candidateMean: 0,
    absoluteDelta: 0,
    relativeDelta: null,
    confidenceInterval: [0, 0],
    confidenceLevel: 0.95,
    probabilityOfImprovement: 0,
    verdict: 'inconclusive',
    sampleCount: 0,
    byTask: [],
  };
}
