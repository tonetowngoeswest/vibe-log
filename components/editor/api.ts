export class EditorRequestError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function editorRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof result?.error === 'string' ? result.error : 'The request could not be completed. Please try again.';
    throw new EditorRequestError(message, response.status);
  }
  if (!result) throw new EditorRequestError('The server returned an empty response. Please reload and try again.', 502);
  return result as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed. Please try again.';
}
