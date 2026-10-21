import { describe, expect, it } from 'vitest';
import { compareRuns } from './comparison';

describe('compareRuns', () => {
  it('uses paired observations and detects a consistent improvement', () => {
    const runs = Array.from({ length: 12 }, (_, repetition) => [
      { taskId: 'task', configId: 'a', repetition, score: 0 },
      { taskId: 'task', configId: 'b', repetition, score: 1 },
    ]).flat();
    const result = compareRuns(runs, 'a', 'b');
    expect(result.verdict).toBe('better');
    expect(result.absoluteDelta).toBe(1);
    expect(result.sampleCount).toBe(12);
  });

  it('returns inconclusive for mixed paired differences', () => {
    const runs = Array.from({ length: 10 }, (_, repetition) => [
      { taskId: 'task', configId: 'a', repetition, score: repetition % 2 },
      { taskId: 'task', configId: 'b', repetition, score: (repetition + 1) % 2 },
    ]).flat();
    expect(compareRuns(runs, 'a', 'b').verdict).toBe('inconclusive');
  });
});
