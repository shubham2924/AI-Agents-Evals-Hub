export type ScorerType = 'exact' | 'contains' | 'regex' | 'json';
export type RunnerType = 'demo' | 'hermes';
export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'error';

export interface Task {
  id: string;
  taskSetId: string;
  name: string;
  prompt: string;
  scorerType: ScorerType;
  expected: string;
  weight: number;
}

export interface TaskSet {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  tasks: Task[];
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  skills: string[];
  tools: string[];
  memoryEnabled: boolean;
  systemPrompt: string;
  createdAt: string;
}

export interface ExperimentSummary {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'completed' | 'failed';
  taskSetId: string;
  baselineConfigId: string;
  candidateConfigId: string;
  runnerType: RunnerType;
  repetitions: number;
  createdAt: string;
  completedAt: string | null;
  baselineScore: number | null;
  candidateScore: number | null;
}

export interface Run {
  id: string;
  experimentId: string;
  taskId: string;
  configId: string;
  repetition: number;
  status: RunStatus;
  output: string;
  score: number | null;
  scorerReason: string;
  latencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  exitCode: number | null;
  error: string | null;
  trace: TraceEvent[];
  createdAt: string;
  completedAt: string | null;
}

export interface TraceEvent {
  at: string;
  type: 'system' | 'prompt' | 'tool' | 'response' | 'score' | 'error';
  title: string;
  content: string;
}

export interface Comparison {
  baselineMean: number;
  candidateMean: number;
  absoluteDelta: number;
  relativeDelta: number | null;
  confidenceInterval: [number, number];
  confidenceLevel: number;
  probabilityOfImprovement: number;
  verdict: 'better' | 'worse' | 'inconclusive';
  sampleCount: number;
  byTask: Array<{ taskId: string; baseline: number; candidate: number; delta: number }>;
}

export interface ExperimentDetail extends ExperimentSummary {
  taskSet: TaskSet;
  baselineConfig: AgentConfig;
  candidateConfig: AgentConfig;
  runs: Run[];
  comparison: Comparison;
}

export interface RunDetail extends Run {
  task: Task;
  config: AgentConfig;
}
