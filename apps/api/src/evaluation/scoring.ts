import type { ScorerType } from '@agent-evals/shared';

export interface ScoreResult {
  score: number;
  reason: string;
}

export function scoreOutput(type: ScorerType, expected: string, output: string): ScoreResult {
  switch (type) {
    case 'exact':
      return scoreExact(expected, output);
    case 'contains':
      return scoreContains(expected, output);
    case 'regex':
      return scoreRegex(expected, output);
    case 'json':
      return scoreJson(expected, output);
  }
}

function scoreExact(expected: string, output: string): ScoreResult {
  const passed = normalize(output) === normalize(expected);
  return {
    score: Number(passed),
    reason: passed
      ? 'Normalized output exactly matched the expected answer.'
      : `Expected exactly “${expected}”.`,
  };
}

function scoreContains(expected: string, output: string): ScoreResult {
  const terms = expected.split('|').map(normalize).filter(Boolean);
  const normalizedOutput = normalize(output);
  const missing = terms.filter((term) => !normalizedOutput.includes(term));
  return {
    score: Number(missing.length === 0),
    reason:
      missing.length === 0
        ? 'All required phrases were present.'
        : `Missing required phrase${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
  };
}

function scoreRegex(expected: string, output: string): ScoreResult {
  try {
    const passed = new RegExp(expected, 'i').test(output);
    return {
      score: Number(passed),
      reason: passed ? 'Output matched the required pattern.' : `Output did not match /${expected}/i.`,
    };
  } catch {
    return { score: 0, reason: 'The scorer has an invalid regular expression.' };
  }
}

function scoreJson(expected: string, output: string): ScoreResult {
  try {
    const actual = JSON.stringify(sortObject(JSON.parse(output)));
    const wanted = JSON.stringify(sortObject(JSON.parse(expected)));
    const passed = actual === wanted;
    return {
      score: Number(passed),
      reason: passed ? 'Parsed JSON matched the expected structure.' : `Expected JSON ${expected}.`,
    };
  } catch {
    return { score: 0, reason: 'Output was not valid JSON.' };
  }
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortObject(item)]),
    );
  }
  return value;
}
