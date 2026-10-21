interface ErrorResponse {
  message?: string | string[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorResponse | null;
    const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
    throw new ApiError(response.status, message ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}
