import { DatabaseService } from './database';
import { ids, sampleTasks } from './seed-data';

export function seed(dbService: DatabaseService) {
  const db = dbService.db;
  const now = '2026-10-10T10:00:00.000Z';
  db.prepare('INSERT OR IGNORE INTO task_sets VALUES (?, ?, ?, ?)').run(
    ids.taskSet, 'Customer support essentials', 'Five small tasks covering policy use, routing, extraction, and safe escalation.', now,
  );
  const addTask = db.prepare('INSERT OR IGNORE INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const task of sampleTasks) addTask.run(task.id, ids.taskSet, task.name, task.prompt, task.scorerType, task.expected, task.weight);

  const addConfig = db.prepare('INSERT OR IGNORE INTO agent_configs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  addConfig.run(ids.baseline, 'General assistant', 'Hermes with a general instruction and no domain skill.', 'openai-api', 'gpt-5.4-mini', '[]', '["safe"]', 0, 'Answer accurately and concisely.', now);
  addConfig.run(ids.candidate, 'Support specialist', 'Same model with support triage guidance and memory enabled.', 'openai-api', 'gpt-5.4-mini', '["support-triage"]', '["safe"]', 1, 'Follow support policy exactly. Never invent compensation. Escalate account security incidents.', now);

  // Keep databases created by earlier versions aligned with the documented direct OpenAI setup.
  db.prepare('UPDATE agent_configs SET provider = ?, model = ? WHERE id IN (?, ?)').run(
    'openai-api', 'gpt-5.4-mini', ids.baseline, ids.candidate,
  );

  const existing = db.prepare('SELECT id FROM experiments WHERE id = ?').get(ids.experiment);
  if (!existing) {
    db.prepare('INSERT INTO experiments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      ids.experiment, 'Support skill v1', 'completed', ids.taskSet, ids.baseline, ids.candidate, 'demo', 3, now, '2026-10-10T10:01:00.000Z',
    );
    seedSampleRuns(dbService, now);
  }
  // Seeded runs use the local demo adapter and therefore never represent model spend.
  db.prepare('UPDATE runs SET estimated_cost_usd = 0 WHERE experiment_id = ?').run(ids.experiment);
}

function seedSampleRuns(dbService: DatabaseService, createdAt: string) {
  const db = dbService.db;
  const outcomes: Record<string, [string, string]> = {
    'refund-window': ['yes', 'yes'],
    'priority-routing': ['high', 'urgent'],
    'extract-order': ['{"orderId":"ORD-4821"}', '{"orderId":"ORD-4821"}'],
    'safe-escalation': ['Please reset your password.', 'Secure the account now; I am escalating this to the security team.'],
    'no-hallucinated-credit': ['I can add a $50 credit.', 'I cannot confirm a credit; a human should review this request.'],
  };
  const add = db.prepare(`INSERT INTO runs
    (id, experiment_id, task_id, config_id, repetition, status, output, score, scorer_reason, latency_ms, input_tokens, output_tokens, estimated_cost_usd, exit_code, error, trace_json, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (let repetition = 1; repetition <= 3; repetition++) {
    for (const task of sampleTasks) {
      for (const [index, configId] of [ids.baseline, ids.candidate].entries()) {
        const output = outcomes[task.id][index];
        const normalized = output.trim().toLowerCase();
        const score = task.scorerType === 'exact' ? Number(normalized === task.expected.toLowerCase())
          : task.scorerType === 'json' ? Number(output === task.expected)
          : Number(task.expected.split('|').every((term) => normalized.includes(term)));
        const status = score === 1 ? 'passed' : 'failed';
        const trace = [
          { at: createdAt, type: 'system', title: 'Configuration loaded', content: `${configId} · demo runner` },
          { at: createdAt, type: 'prompt', title: task.name, content: task.prompt },
          { at: createdAt, type: 'response', title: 'Agent response', content: output },
          { at: createdAt, type: 'score', title: score ? 'Passed' : 'Failed', content: score ? 'Output met the scorer criteria.' : 'Output did not meet the scorer criteria.' },
        ];
        add.run(`${ids.experiment}-${task.id}-${configId}-${repetition}`, ids.experiment, task.id, configId, repetition,
          status, output, score, score ? 'Output met the scorer criteria.' : 'Output did not meet the scorer criteria.',
          420 + repetition * 31 + index * 80, 80 + task.prompt.length / 4 | 0, 8 + output.length / 4 | 0,
          0, 0, null, JSON.stringify(trace), createdAt, createdAt);
      }
    }
  }
}

if (require.main === module) {
  const database = new DatabaseService();
  seed(database);
  database.onModuleDestroy();
  console.log('Sample data seeded.');
}
