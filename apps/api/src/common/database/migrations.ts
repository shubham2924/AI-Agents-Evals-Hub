export interface Migration {
  version: number;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS task_sets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        task_set_id TEXT NOT NULL REFERENCES task_sets(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        scorer_type TEXT NOT NULL CHECK (scorer_type IN ('exact', 'contains', 'regex', 'json')),
        expected TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1 CHECK (weight >= 0 AND weight <= 100)
      );

      CREATE TABLE IF NOT EXISTS agent_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        skills_json TEXT NOT NULL,
        tools_json TEXT NOT NULL,
        memory_enabled INTEGER NOT NULL CHECK (memory_enabled IN (0, 1)),
        system_prompt TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'running', 'completed', 'failed')),
        task_set_id TEXT NOT NULL REFERENCES task_sets(id),
        baseline_config_id TEXT NOT NULL REFERENCES agent_configs(id),
        candidate_config_id TEXT NOT NULL REFERENCES agent_configs(id),
        runner_type TEXT NOT NULL CHECK (runner_type IN ('demo', 'hermes')),
        repetitions INTEGER NOT NULL CHECK (repetitions BETWEEN 1 AND 20),
        created_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL REFERENCES tasks(id),
        config_id TEXT NOT NULL REFERENCES agent_configs(id),
        repetition INTEGER NOT NULL CHECK (repetition >= 1),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'passed', 'failed', 'error')),
        output TEXT NOT NULL DEFAULT '',
        score REAL CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
        scorer_reason TEXT NOT NULL DEFAULT '',
        latency_ms INTEGER,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd REAL NOT NULL DEFAULT 0,
        exit_code INTEGER,
        error TEXT,
        trace_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        completed_at TEXT,
        UNIQUE(experiment_id, task_id, config_id, repetition)
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_task_set ON tasks(task_set_id);
      CREATE INDEX IF NOT EXISTS idx_runs_experiment ON runs(experiment_id);
      CREATE INDEX IF NOT EXISTS idx_runs_experiment_config ON runs(experiment_id, config_id);

      PRAGMA user_version = 1;
    `,
  },
];
