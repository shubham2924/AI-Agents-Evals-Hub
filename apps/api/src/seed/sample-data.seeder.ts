import { Inject, Injectable } from '@nestjs/common';
import type { TraceEvent } from '@agent-evals/shared';
import { DatabaseService } from '../common/database/database.service';
import { scoreOutput } from '../evaluation/scoring';
import { sampleIds, sampleTasks } from './sample-data';

const SEEDED_AT = '2026-10-10T10:00:00.000Z';

@Injectable()
export class SampleDataSeeder {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  seed() {
    this.database.transaction(() => {
      this.seedTaskSet();
      this.seedAgentConfigs();
      this.seedExperiment();
    });
  }

  private seedTaskSet() {
    this.database.connection
      .prepare(
        `
      INSERT OR IGNORE INTO task_sets (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `,
      )
      .run(
        sampleIds.taskSet,
        'Customer support essentials',
        'Five small tasks covering policy use, routing, extraction, and safe escalation.',
        SEEDED_AT,
      );
    const insertTask = this.database.connection.prepare(`
      INSERT OR IGNORE INTO tasks (
        id, task_set_id, name, prompt, scorer_type, expected, weight
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const task of sampleTasks) {
      insertTask.run(
        task.id,
        sampleIds.taskSet,
        task.name,
        task.prompt,
        task.scorerType,
        task.expected,
        task.weight,
      );
    }
  }

  private seedAgentConfigs() {
    const insertConfig = this.database.connection.prepare(`
      INSERT OR IGNORE INTO agent_configs (
        id, name, description, provider, model, skills_json, tools_json,
        memory_enabled, system_prompt, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertConfig.run(
      sampleIds.baseline,
      'General assistant',
      'Hermes with a general instruction and no domain skill.',
      'openai-api',
      'gpt-5.4-mini',
      '[]',
      '["safe"]',
      0,
      'Answer accurately and concisely.',
      SEEDED_AT,
    );
    insertConfig.run(
      sampleIds.candidate,
      'Support specialist',
      'Same model with support triage guidance and memory enabled.',
      'openai-api',
      'gpt-5.4-mini',
      '["support-triage"]',
      '["safe"]',
      1,
      'Follow support policy exactly. Never invent compensation. Escalate account security incidents.',
      SEEDED_AT,
    );
    this.database.connection
      .prepare(
        `
      UPDATE agent_configs
      SET provider = ?, model = ?
      WHERE id IN (?, ?)
    `,
      )
      .run('openai-api', 'gpt-5.4-mini', sampleIds.baseline, sampleIds.candidate);
  }

  private seedExperiment() {
    const existing = this.database.connection
      .prepare('SELECT id FROM experiments WHERE id = ?')
      .get(sampleIds.experiment);
    if (!existing) {
      this.database.connection
        .prepare(
          `
        INSERT INTO experiments (
          id, name, status, task_set_id, baseline_config_id, candidate_config_id,
          runner_type, repetitions, created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          sampleIds.experiment,
          'Support skill v1',
          'completed',
          sampleIds.taskSet,
          sampleIds.baseline,
          sampleIds.candidate,
          'demo',
          3,
          SEEDED_AT,
          '2026-10-10T10:01:00.000Z',
        );
      this.seedRuns();
    }
    this.database.connection
      .prepare(
        `
      UPDATE runs
      SET estimated_cost_usd = 0
      WHERE experiment_id = ?
    `,
      )
      .run(sampleIds.experiment);
  }

  private seedRuns() {
    const outcomes: Record<string, readonly [string, string]> = {
      'refund-window': ['yes', 'yes'],
      'priority-routing': ['high', 'urgent'],
      'extract-order': ['{"orderId":"ORD-4821"}', '{"orderId":"ORD-4821"}'],
      'safe-escalation': [
        'Please reset your password.',
        'Secure the account now; I am escalating this to the security team.',
      ],
      'no-hallucinated-credit': [
        'I can add a $50 credit.',
        'I cannot confirm a credit; a human should review this request.',
      ],
    };
    const insertRun = this.database.connection.prepare(`
      INSERT INTO runs (
        id, experiment_id, task_id, config_id, repetition, status, output, score,
        scorer_reason, latency_ms, input_tokens, output_tokens, estimated_cost_usd,
        exit_code, error, trace_json, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (let repetition = 1; repetition <= 3; repetition++) {
      for (const task of sampleTasks) {
        const taskOutcomes = outcomes[task.id];
        if (!taskOutcomes) throw new Error(`Missing seeded outcomes for ${task.id}.`);
        for (const [index, configId] of [sampleIds.baseline, sampleIds.candidate].entries()) {
          const output = taskOutcomes[index];
          const scoring = scoreOutput(task.scorerType, task.expected, output);
          const status = scoring.score === 1 ? 'passed' : 'failed';
          const trace: TraceEvent[] = [
            {
              at: SEEDED_AT,
              type: 'system',
              title: 'Configuration loaded',
              content: `${configId} · demo runner`,
            },
            { at: SEEDED_AT, type: 'prompt', title: task.name, content: task.prompt },
            { at: SEEDED_AT, type: 'response', title: 'Agent response', content: output },
            {
              at: SEEDED_AT,
              type: 'score',
              title: scoring.score ? 'Passed' : 'Failed',
              content: scoring.reason,
            },
          ];
          insertRun.run(
            `${sampleIds.experiment}-${task.id}-${configId}-${repetition}`,
            sampleIds.experiment,
            task.id,
            configId,
            repetition,
            status,
            output,
            scoring.score,
            scoring.reason,
            420 + repetition * 31 + index * 80,
            Math.ceil((80 + task.prompt.length) / 4),
            Math.ceil((8 + output.length) / 4),
            0,
            0,
            null,
            JSON.stringify(trace),
            SEEDED_AT,
            SEEDED_AT,
          );
        }
      }
    }
  }
}
