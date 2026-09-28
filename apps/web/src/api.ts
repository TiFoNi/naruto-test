const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') ?? ''

const LANGS = new Set(['ru', 'uk', 'en'])

const speaking = () => {
  if (typeof document === 'undefined') return null
  const [, first] = document.location.pathname.split('/')
  return LANGS.has(first) ? first : null
}

export async function api<T = Record<string, unknown>>(path: string, body?: unknown) {
  const lang = speaking()
  const response = await fetch(`${base}/api/${path}`, {
    signal: AbortSignal.timeout(15000),
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(lang ? { 'x-nanda-lang': lang } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: base ? 'include' : 'same-origin',
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  return { ok: response.ok, status: response.status, data }
}

export const apiSrc = (path?: string) => (path && base ? `${base}${path}` : path)
