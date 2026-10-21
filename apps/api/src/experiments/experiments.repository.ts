import { Inject, Injectable } from '@nestjs/common';
import type { ExperimentSummary, Run, RunnerType, RunStatus, TraceEvent } from '@agent-evals/shared';
import { DatabaseService } from '../common/database/database.service';
import { parseTrace } from '../common/persistence/json';
import type { CreateExperimentDto } from './dto/create-experiment.dto';

interface ExperimentRow {
  id: string;
  name: string;
  status: string;
  task_set_id: string;
  baseline_config_id: string;
  candidate_config_id: string;
  runner_type: string;
  repetitions: number;
  created_at: string;
  completed_at: string | null;
  baseline_score: number | null;
  candidate_score: number | null;
}

interface RunRow {
  id: string;
  experiment_id: string;
  task_id: string;
  config_id: string;
  repetition: number;
  status: string;
  output: string;
  score: number | null;
  scorer_reason: string;
  latency_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number;
  exit_code: number | null;
  error: string | null;
  trace_json: string;
  created_at: string;
  completed_at: string | null;
}

export interface CompletedRunUpdate {
  status: Extract<RunStatus, 'passed' | 'failed' | 'error'>;
  output: string;
  score: number | null;
  scorerReason: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  exitCode: number;
  error: string | null;
  trace: TraceEvent[];
}

const experimentSelect = `
  SELECT
    e.id, e.name, e.status, e.task_set_id, e.baseline_config_id,
    e.candidate_config_id, e.runner_type, e.repetitions, e.created_at,
    e.completed_at,
    AVG(CASE WHEN r.config_id = e.baseline_config_id THEN r.score END) AS baseline_score,
    AVG(CASE WHEN r.config_id = e.candidate_config_id THEN r.score END) AS candidate_score
  FROM experiments AS e
  LEFT JOIN runs AS r ON r.experiment_id = e.id
`;

const runColumns = `
  id, experiment_id, task_id, config_id, repetition, status, output, score,
  scorer_reason, latency_ms, input_tokens, output_tokens, estimated_cost_usd,
  exit_code, error, trace_json, created_at, completed_at
`;

@Injectable()
export class ExperimentsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  findAll(): ExperimentSummary[] {
    const rows = this.database.connection
      .prepare(
        `
      ${experimentSelect}
      GROUP BY e.id
      ORDER BY e.created_at DESC, e.id ASC
    `,
      )
      .all() as unknown as ExperimentRow[];
    return rows.map(mapExperiment);
  }

  findById(id: string): ExperimentSummary | null {
    const row = this.database.connection
      .prepare(
        `
      ${experimentSelect}
      WHERE e.id = ?
      GROUP BY e.id
    `,
      )
      .get(id) as unknown as ExperimentRow | undefined;
    return row ? mapExperiment(row) : null;
  }

  create(input: CreateExperimentDto): ExperimentSummary {
    const id = crypto.randomUUID();
    this.database.connection
      .prepare(
        `
      INSERT INTO experiments (
        id, name, status, task_set_id, baseline_config_id, candidate_config_id,
        runner_type, repetitions, created_at, completed_at
      ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, NULL)
    `,
      )
      .run(
        id,
        input.name,
        input.taskSetId,
        input.baselineConfigId,
        input.candidateConfigId,
        input.runnerType,
        input.repetitions,
        new Date().toISOString(),
      );
    return this.findById(id)!;
  }

  prepareRun(experimentId: string) {
    this.database.transaction(() => {
      this.database.connection.prepare('DELETE FROM runs WHERE experiment_id = ?').run(experimentId);
      this.database.connection
        .prepare(
          `
        UPDATE experiments
        SET status = 'running', completed_at = NULL
        WHERE id = ?
      `,
        )
        .run(experimentId);
    });
  }

  setStatus(id: string, status: ExperimentSummary['status']) {
    const completedAt = status === 'completed' || status === 'failed' ? new Date().toISOString() : null;
    this.database.connection
      .prepare(
        `
      UPDATE experiments
      SET status = ?, completed_at = ?
      WHERE id = ?
    `,
      )
      .run(status, completedAt, id);
  }

  insertQueuedRuns(
    inputs: Array<{ id: string; experimentId: string; taskId: string; configId: string; repetition: number }>,
  ) {
    this.database.transaction(() => {
      const insert = this.database.connection.prepare(`
        INSERT INTO runs (
          id, experiment_id, task_id, config_id, repetition, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', ?)
      `);
      for (const input of inputs) {
        insert.run(
          input.id,
          input.experimentId,
          input.taskId,
          input.configId,
          input.repetition,
          new Date().toISOString(),
        );
      }
    });
  }

  markRunRunning(id: string) {
    this.database.connection
      .prepare(
        `
      UPDATE runs
      SET status = 'running'
      WHERE id = ? AND status = 'queued'
    `,
      )
      .run(id);
  }

  updateRun(id: string, fields: CompletedRunUpdate) {
    this.database.connection
      .prepare(
        `
      UPDATE runs SET
        status = ?, output = ?, score = ?, scorer_reason = ?, latency_ms = ?,
        input_tokens = ?, output_tokens = ?, estimated_cost_usd = ?, exit_code = ?,
        error = ?, trace_json = ?, completed_at = ?
      WHERE id = ?
    `,
      )
      .run(
        fields.status,
        fields.output,
        fields.score,
        fields.scorerReason,
        fields.latencyMs,
        fields.inputTokens,
        fields.outputTokens,
        fields.estimatedCostUsd,
        fields.exitCode,
        fields.error,
        JSON.stringify(fields.trace),
        new Date().toISOString(),
        id,
      );
  }

  findRuns(experimentId: string): Run[] {
    const rows = this.database.connection
      .prepare(
        `
      SELECT ${runColumns}
      FROM runs
      WHERE experiment_id = ?
      ORDER BY task_id ASC, config_id ASC, repetition ASC
    `,
      )
      .all(experimentId) as unknown as RunRow[];
    return rows.map(mapRun);
  }

  findRunById(id: string): Run | null {
    const row = this.database.connection
      .prepare(
        `
      SELECT ${runColumns}
      FROM runs
      WHERE id = ?
    `,
      )
      .get(id) as unknown as RunRow | undefined;
    return row ? mapRun(row) : null;
  }
}

function mapExperiment(row: ExperimentRow): ExperimentSummary {
  if (!['draft', 'running', 'completed', 'failed'].includes(row.status)) {
    throw new Error(`Experiment ${row.id} has an invalid status.`);
  }
  if (!['demo', 'hermes'].includes(row.runner_type)) {
    throw new Error(`Experiment ${row.id} has an invalid runner type.`);
  }
  return {
    id: row.id,
    name: row.name,
    status: row.status as ExperimentSummary['status'],
    taskSetId: row.task_set_id,
    baselineConfigId: row.baseline_config_id,
    candidateConfigId: row.candidate_config_id,
    runnerType: row.runner_type as RunnerType,
    repetitions: row.repetitions,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    baselineScore: row.baseline_score,
    candidateScore: row.candidate_score,
  };
}

function mapRun(row: RunRow): Run {
  if (!['queued', 'running', 'passed', 'failed', 'error'].includes(row.status)) {
    throw new Error(`Run ${row.id} has an invalid status.`);
  }
  return {
    id: row.id,
    experimentId: row.experiment_id,
    taskId: row.task_id,
    configId: row.config_id,
    repetition: row.repetition,
    status: row.status as RunStatus,
    output: row.output,
    score: row.score,
    scorerReason: row.scorer_reason,
    latencyMs: row.latency_ms,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    estimatedCostUsd: row.estimated_cost_usd,
    exitCode: row.exit_code,
    error: row.error,
    trace: parseTrace(row.trace_json),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
