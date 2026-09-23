export function json(data: unknown, status = 200, cookie?: string) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  if (cookie) headers.append('set-cookie', cookie)
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

function crossSite(request: Request) {
  if (request.method === 'GET') return false
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return true
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host && new URL(origin).host !== host) return true
  return !request.headers.get('content-type')?.includes('application/json')
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
