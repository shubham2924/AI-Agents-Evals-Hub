import type { TraceEvent } from '@agent-evals/shared';

export function parseStringArray(value: string, field: string): string[] {
  const parsed = parseJson(value, field);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error(`Persisted ${field} must be an array of strings.`);
  }
  return parsed;
}

export function parseTrace(value: string): TraceEvent[] {
  const parsed = parseJson(value, 'run trace');
  if (!Array.isArray(parsed)) throw new Error('Persisted run trace must be an array.');
  return parsed.map((event, index) => {
    if (!isTraceEvent(event)) throw new Error(`Persisted run trace event ${index} is invalid.`);
    return event;
  });
}

function parseJson(value: string, field: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`Persisted ${field} contains invalid JSON.`);
  }
}

function isTraceEvent(value: unknown): value is TraceEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  return (
    typeof event.at === 'string' &&
    typeof event.title === 'string' &&
    typeof event.content === 'string' &&
    ['system', 'prompt', 'tool', 'response', 'score', 'error'].includes(String(event.type))
  );
}
