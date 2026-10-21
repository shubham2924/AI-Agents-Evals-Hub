import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns parsed JSON for successful requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    await expect(api<{ status: string }>('/health')).resolves.toEqual({ status: 'ok' });
  });

  it('normalizes validation message arrays into a typed API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: ['name must be shorter', 'runnerType is invalid'],
          }),
          {
            status: 400,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    await expect(api('/experiments')).rejects.toEqual(
      new ApiError(400, 'name must be shorter runnerType is invalid'),
    );
  });
});
