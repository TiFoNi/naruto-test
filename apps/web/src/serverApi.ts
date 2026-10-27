import { cookies } from 'next/headers'

const API = (process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '')

const WAIT = 1500

export async function apiAsUser<T>(path: string): Promise<T | null> {
  if (!API) return null
  const cookie = (await cookies()).toString()
  if (!cookie) return null
  try {
    const res = await fetch(`${API}/api/${path}`, {
      headers: { cookie },
      cache: 'no-store',
      signal: AbortSignal.timeout(WAIT),
    })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}
