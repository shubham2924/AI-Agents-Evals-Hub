import type { AgentConfig, Task, TraceEvent } from '@agent-evals/shared';

export interface EvaluationRunInput {
  experimentId: string;
  runId: string;
  task: Task;
  config: AgentConfig;
  repetition: number;
}

export interface RunnerResult {
  output: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  exitCode: number;
  error: string | null;
  trace: TraceEvent[];
}

export interface EvaluationRunner {
  run(input: EvaluationRunInput): Promise<RunnerResult>;
}
