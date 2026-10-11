import type { ScorerType } from '@agent-evals/shared';

export interface ScoreResult { score: number; reason: string }

function normalize(value: string) { return value.trim().replace(/\s+/g, ' ').toLowerCase(); }

export function scoreOutput(type: ScorerType, expected: string, output: string): ScoreResult {
  if (type === 'exact') {
    const passed = normalize(output) === normalize(expected);
    return { score: Number(passed), reason: passed ? 'Normalized output exactly matched the expected answer.' : `Expected exactly “${expected}”.` };
  }
  if (type === 'contains') {
    const terms = expected.split('|').map(normalize).filter(Boolean);
    const missing = terms.filter((term) => !normalize(output).includes(term));
    return { score: Number(missing.length === 0), reason: missing.length ? `Missing required phrase${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.` : 'All required phrases were present.' };
  }
  if (type === 'regex') {
    try {
      const passed = new RegExp(expected, 'i').test(output);
      return { score: Number(passed), reason: passed ? 'Output matched the required pattern.' : `Output did not match /${expected}/i.` };
    } catch { return { score: 0, reason: 'The scorer has an invalid regular expression.' }; }
  }
  try {
    const actual = JSON.stringify(sortObject(JSON.parse(output)));
    const wanted = JSON.stringify(sortObject(JSON.parse(expected)));
    const passed = actual === wanted;
    return { score: Number(passed), reason: passed ? 'Parsed JSON matched the expected structure.' : `Expected JSON ${expected}.` };
  } catch { return { score: 0, reason: 'Output was not valid JSON.' }; }
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortObject(item)]));
  return value;
}
