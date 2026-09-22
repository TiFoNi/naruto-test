export async function api<T = Record<string, unknown>>(path: string, body?: unknown) {
  const response = await fetch(`/api/${path}`, {
    signal: AbortSignal.timeout(15000),
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  return { ok: response.ok, status: response.status, data }
}
