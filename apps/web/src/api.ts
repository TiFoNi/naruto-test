const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') ?? ''

export async function api<T = Record<string, unknown>>(path: string, body?: unknown) {
  const response = await fetch(`${base}/api/${path}`, {
    signal: AbortSignal.timeout(15000),
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: base ? 'include' : 'same-origin',
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  return { ok: response.ok, status: response.status, data }
}

export const apiSrc = (path?: string) => (path && base ? `${base}${path}` : path)
