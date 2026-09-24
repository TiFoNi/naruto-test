export function json(data: unknown, status = 200, cookie?: string | string[]) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  for (const value of cookie === undefined ? [] : [cookie].flat()) headers.append('set-cookie', value)
  return new Response(JSON.stringify(data), { status, headers })
}

export const fail = (status: number, error: string) => json({ error }, status)

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const trusted = new Set(
  (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

function crossSite(request: Request) {
  if (request.method === 'GET') return false

  const type = request.headers.get('content-type') ?? ''
  const upload = type.includes('multipart/form-data')
  if (!upload && !type.includes('application/json')) return true

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  const sameOrigin = !!origin && !!host && new URL(origin).host === host
  const known = sameOrigin || (!!origin && trusted.has(origin))
  const allowed = upload ? known : !origin || known
  if (!allowed) return true

  const site = request.headers.get('sec-fetch-site')
  if (site === 'cross-site') return true
  if (site === 'same-site' && !sameOrigin && !(origin && trusted.has(origin))) return true
  return false
}

export function handle(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (crossSite(request)) return fail(403, 'forbidden')
    try {
      return await fn(request)
    } catch (error) {
      console.error(error)
      return fail(500, 'server')
    }
  }
}
