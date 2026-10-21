import { Injectable } from '@nestjs/common';
import type { Task } from '@agent-evals/shared';
import type { EvaluationRunner, EvaluationRunInput, RunnerResult } from './runner.types';

@Injectable()
export class DemoRunnerService implements EvaluationRunner {
  async run({ task, config, repetition }: EvaluationRunInput): Promise<RunnerResult> {
    const startedAt = Date.now();
    const reliability = config.skills.length > 0 || config.memoryEnabled ? 0.85 : 0.55;
    const passed = deterministicValue(`${task.id}:${config.id}:${repetition}`) < reliability;
    const output = passed
      ? passingOutput(task)
      : 'I’m unable to determine that from the information provided.';
    await delay(40 + Math.floor(deterministicValue(config.id + task.id) * 80));
    const now = new Date().toISOString();
    return {
      output,
      latencyMs: Date.now() - startedAt,
      inputTokens: Math.ceil(task.prompt.length / 4),
      outputTokens: Math.ceil(output.length / 4),
      estimatedCostUsd: 0,
      exitCode: 0,
      error: null,
      trace: [
        {
          at: now,
          type: 'system',
          title: 'Demo runner',
          content: `${config.name} · deterministic local simulation (no model API call)`,
        },
        { at: now, type: 'prompt', title: task.name, content: task.prompt },
        { at: now, type: 'response', title: 'Agent response', content: output },
      ],
    };
  }
}

function passingOutput(task: Task) {
  if (task.scorerType === 'contains') return task.expected.split('|').join(' — ');
  if (task.scorerType === 'regex') return task.expected.replace(/[\\^$.*+?()[\]{}|]/g, '');
  return task.expected;
}

function deterministicValue(input: string) {
  let hash = 2_166_136_261;
  for (const character of input) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 2 ** 32;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
