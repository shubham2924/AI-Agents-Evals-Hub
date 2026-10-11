import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { projectRoot } from './paths';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: DatabaseSync;

  constructor() {
    const dbPath = resolve(projectRoot, process.env.DATABASE_PATH ?? 'data/agent-evals.db');
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  onModuleDestroy() { this.db.close(); }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_sets (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, task_set_id TEXT NOT NULL REFERENCES task_sets(id) ON DELETE CASCADE,
        name TEXT NOT NULL, prompt TEXT NOT NULL, scorer_type TEXT NOT NULL,
        expected TEXT NOT NULL, weight REAL NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS agent_configs (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
        provider TEXT NOT NULL, model TEXT NOT NULL, skills_json TEXT NOT NULL,
        tools_json TEXT NOT NULL, memory_enabled INTEGER NOT NULL,
        system_prompt TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL,
        task_set_id TEXT NOT NULL REFERENCES task_sets(id),
        baseline_config_id TEXT NOT NULL REFERENCES agent_configs(id),
        candidate_config_id TEXT NOT NULL REFERENCES agent_configs(id),
        runner_type TEXT NOT NULL, repetitions INTEGER NOT NULL,
        created_at TEXT NOT NULL, completed_at TEXT
      );
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY, experiment_id TEXT NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL REFERENCES tasks(id), config_id TEXT NOT NULL REFERENCES agent_configs(id),
        repetition INTEGER NOT NULL, status TEXT NOT NULL, output TEXT NOT NULL DEFAULT '',
        score REAL, scorer_reason TEXT NOT NULL DEFAULT '', latency_ms INTEGER,
        input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd REAL NOT NULL DEFAULT 0, exit_code INTEGER, error TEXT,
        trace_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL, completed_at TEXT,
        UNIQUE(experiment_id, task_id, config_id, repetition)
      );
      CREATE INDEX IF NOT EXISTS idx_runs_experiment ON runs(experiment_id);
    `);
  }
}
