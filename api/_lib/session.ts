import { SignJWT, jwtVerify } from 'jose'

const COOKIE = 'session'
const MAX_AGE = 60 * 60 * 24 * 30

export type SessionUser = { id: string; username: string }

function secret() {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters')
  return new TextEncoder().encode(value)
}

const secure = (request: Request) => (new URL(request.url).protocol === 'https:' ? '; Secure' : '')

export async function sessionCookie(request: Request, user: SessionUser) {
  const token = await new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure(request)}`
}

export const clearedCookie = (request: Request) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(request)}`

export async function readSession(request: Request): Promise<SessionUser | null> {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === COOKIE)?.[1]
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    return payload.sub && typeof payload.username === 'string' ? { id: payload.sub, username: payload.username } : null
  } catch {
    return null
  }
}
