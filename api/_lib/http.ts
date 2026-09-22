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

export function handle(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await fn(request)
    } catch (error) {
      console.error(error)
      return fail(500, 'server')
    }
  }
}
