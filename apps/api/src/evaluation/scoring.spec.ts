import { describe, expect, it } from 'vitest';
import { scoreOutput } from './scoring';

describe('scoreOutput', () => {
  it('normalizes exact answers but does not accept extra prose', () => {
    expect(scoreOutput('exact', 'Yes', ' yes\n').score).toBe(1);
    expect(scoreOutput('exact', 'Yes', 'Yes, you can.').score).toBe(0);
  });

  it('requires every contains term', () => {
    expect(scoreOutput('contains', 'secure|security', 'Secure it and tell the security team.').score).toBe(1);
    expect(scoreOutput('contains', 'secure|security', 'Secure it.').score).toBe(0);
  });

  it('compares JSON independent of key order', () => {
    expect(scoreOutput('json', '{"a":1,"b":2}', '{"b":2,"a":1}').score).toBe(1);
  });
});
