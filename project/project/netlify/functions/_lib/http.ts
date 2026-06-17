export function json(statusCode: number, body: unknown, headers?: Record<string, string>) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: JSON.stringify(body),
  };
}

export function assertPost(method: string) {
  if (method !== 'POST') {
    const err: any = new Error('Method not allowed');
    err.statusCode = 405;
    throw err;
  }
}

export function parseJson<T = any>(body: string | null | undefined): T {
  if (!body) return {} as any;
  return JSON.parse(body);
}
