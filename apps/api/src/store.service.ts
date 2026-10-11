import { Injectable, NotFoundException } from '@nestjs/common';
import type { AgentConfig, ExperimentSummary, Run, Task, TaskSet, TraceEvent } from '@agent-evals/shared';
import { DatabaseService } from './database';
import { compareRuns } from './comparison';

@Injectable()
export class StoreService {
  constructor(private readonly database: DatabaseService) {}

  listTaskSets(): TaskSet[] {
    const sets = this.database.db.prepare('SELECT * FROM task_sets ORDER BY created_at DESC').all() as any[];
    return sets.map((row) => ({ id: row.id, name: row.name, description: row.description, createdAt: row.created_at, tasks: this.getTasks(row.id) }));
  }
  getTaskSet(id: string) { const set = this.listTaskSets().find((item) => item.id === id); if (!set) throw new NotFoundException('Task set not found'); return set; }
  getTasks(taskSetId: string): Task[] { return (this.database.db.prepare('SELECT * FROM tasks WHERE task_set_id = ? ORDER BY rowid').all(taskSetId) as any[]).map(mapTask); }
  getTask(id: string): Task { const row = this.database.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any; if (!row) throw new NotFoundException('Task not found'); return mapTask(row); }
  createTaskSet(input: { name: string; description: string; tasks: Array<{ name: string; prompt: string; scorerType: string; expected: string; weight: number }> }) {
    const id = crypto.randomUUID();
    this.database.db.exec('BEGIN');
    try {
      this.database.db.prepare('INSERT INTO task_sets VALUES (?, ?, ?, ?)').run(id, input.name, input.description, new Date().toISOString());
      const insert = this.database.db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const task of input.tasks) insert.run(crypto.randomUUID(), id, task.name, task.prompt, task.scorerType, task.expected, task.weight);
      this.database.db.exec('COMMIT');
    } catch (error) {
      this.database.db.exec('ROLLBACK');
      throw error;
    }
    return this.getTaskSet(id);
  }

  listConfigs(): AgentConfig[] { return (this.database.db.prepare('SELECT * FROM agent_configs ORDER BY created_at').all() as any[]).map(mapConfig); }
  getConfig(id: string): AgentConfig { const row = this.database.db.prepare('SELECT * FROM agent_configs WHERE id = ?').get(id) as any; if (!row) throw new NotFoundException('Agent configuration not found'); return mapConfig(row); }
  createConfig(input: { name: string; description: string; provider: string; model: string; skills: string[]; tools: string[]; memoryEnabled: boolean; systemPrompt: string }) {
    const id = crypto.randomUUID();
    this.database.db.prepare('INSERT INTO agent_configs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, input.name, input.description, input.provider, input.model, JSON.stringify(input.skills), JSON.stringify(input.tools), Number(input.memoryEnabled), input.systemPrompt, new Date().toISOString());
    return this.getConfig(id);
  }

  listExperiments(): ExperimentSummary[] {
    return (this.database.db.prepare(`SELECT e.*,
      AVG(CASE WHEN r.config_id = e.baseline_config_id THEN r.score END) baseline_score,
      AVG(CASE WHEN r.config_id = e.candidate_config_id THEN r.score END) candidate_score
      FROM experiments e LEFT JOIN runs r ON r.experiment_id = e.id GROUP BY e.id ORDER BY e.created_at DESC`).all() as any[]).map(mapExperiment);
  }
  getExperiment(id: string) { const experiment = this.listExperiments().find((item) => item.id === id); if (!experiment) throw new NotFoundException('Experiment not found'); return experiment; }
  getExperimentDetail(id: string) {
    const experiment = this.getExperiment(id);
    const runs = this.listRuns(id);
    const completed = runs.filter((run): run is Run & { score: number } => run.score !== null);
    return { ...experiment, taskSet: this.getTaskSet(experiment.taskSetId), baselineConfig: this.getConfig(experiment.baselineConfigId), candidateConfig: this.getConfig(experiment.candidateConfigId), runs, comparison: compareRuns(completed.map((run) => ({ taskId: run.taskId, configId: run.configId, repetition: run.repetition, score: run.score })), experiment.baselineConfigId, experiment.candidateConfigId) };
  }
  listRuns(experimentId: string): Run[] { return (this.database.db.prepare('SELECT * FROM runs WHERE experiment_id = ? ORDER BY task_id, config_id, repetition').all(experimentId) as any[]).map(mapRun); }
  getRun(id: string) { const row = this.database.db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as any; if (!row) throw new NotFoundException('Run not found'); return { ...mapRun(row), task: this.getTask(row.task_id), config: this.getConfig(row.config_id) }; }

  createExperiment(input: { name: string; taskSetId: string; baselineConfigId: string; candidateConfigId: string; runnerType: string; repetitions: number }) {
    this.getTaskSet(input.taskSetId); this.getConfig(input.baselineConfigId); this.getConfig(input.candidateConfigId);
    const id = crypto.randomUUID();
    this.database.db.prepare('INSERT INTO experiments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, input.name, 'draft', input.taskSetId, input.baselineConfigId, input.candidateConfigId, input.runnerType, input.repetitions, new Date().toISOString(), null);
    return this.getExperiment(id);
  }
  setExperimentStatus(id: string, status: string) { this.database.db.prepare('UPDATE experiments SET status = ?, completed_at = ? WHERE id = ?').run(status, status === 'completed' || status === 'failed' ? new Date().toISOString() : null, id); }
  clearRuns(experimentId: string) { this.database.db.prepare('DELETE FROM runs WHERE experiment_id = ?').run(experimentId); }
  insertQueuedRun(input: { id: string; experimentId: string; taskId: string; configId: string; repetition: number }) {
    this.database.db.prepare(`INSERT INTO runs (id, experiment_id, task_id, config_id, repetition, status, created_at) VALUES (?, ?, ?, ?, ?, 'queued', ?)`).run(input.id, input.experimentId, input.taskId, input.configId, input.repetition, new Date().toISOString());
  }
  updateRun(id: string, fields: { status: string; output: string; score: number | null; scorerReason: string; latencyMs: number | null; inputTokens: number; outputTokens: number; estimatedCostUsd: number; exitCode: number | null; error: string | null; trace: TraceEvent[] }) {
    this.database.db.prepare(`UPDATE runs SET status=?, output=?, score=?, scorer_reason=?, latency_ms=?, input_tokens=?, output_tokens=?, estimated_cost_usd=?, exit_code=?, error=?, trace_json=?, completed_at=? WHERE id=?`).run(fields.status, fields.output, fields.score, fields.scorerReason, fields.latencyMs, fields.inputTokens, fields.outputTokens, fields.estimatedCostUsd, fields.exitCode, fields.error, JSON.stringify(fields.trace), new Date().toISOString(), id);
  }
}

function mapTask(row: any): Task { return { id: row.id, taskSetId: row.task_set_id, name: row.name, prompt: row.prompt, scorerType: row.scorer_type, expected: row.expected, weight: row.weight }; }
function mapConfig(row: any): AgentConfig { return { id: row.id, name: row.name, description: row.description, provider: row.provider, model: row.model, skills: JSON.parse(row.skills_json), tools: JSON.parse(row.tools_json), memoryEnabled: Boolean(row.memory_enabled), systemPrompt: row.system_prompt, createdAt: row.created_at }; }
function mapExperiment(row: any): ExperimentSummary { return { id: row.id, name: row.name, status: row.status, taskSetId: row.task_set_id, baselineConfigId: row.baseline_config_id, candidateConfigId: row.candidate_config_id, runnerType: row.runner_type, repetitions: row.repetitions, createdAt: row.created_at, completedAt: row.completed_at, baselineScore: row.baseline_score ?? null, candidateScore: row.candidate_score ?? null }; }
function mapRun(row: any): Run { return { id: row.id, experimentId: row.experiment_id, taskId: row.task_id, configId: row.config_id, repetition: row.repetition, status: row.status, output: row.output, score: row.score, scorerReason: row.scorer_reason, latencyMs: row.latency_ms, inputTokens: row.input_tokens, outputTokens: row.output_tokens, estimatedCostUsd: row.estimated_cost_usd, exitCode: row.exit_code, error: row.error, trace: JSON.parse(row.trace_json), createdAt: row.created_at, completedAt: row.completed_at }; }
