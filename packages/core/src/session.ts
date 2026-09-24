import { SignJWT, jwtVerify } from 'jose'

const COOKIE = 'session'
const MAX_AGE = 60 * 60 * 24 * 30

export type SessionUser = { id: string; username: string }

function secret() {
  const value = process.env.AUTH_SECRET
  if (!value || value.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters')
  return new TextEncoder().encode(value)
}

const proto = (request: Request) =>
  request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? new URL(request.url).protocol.replace(':', '')

const attributes = (request: Request) => {
  const domain = process.env.COOKIE_DOMAIN
  return `${domain ? `; Domain=${domain}` : ''}${proto(request) === 'https' ? '; Secure' : ''}`
}

export async function sessionCookie(request: Request, user: SessionUser) {
  const token = await new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${attributes(request)}`
}

const expired = (request: Request, domain: string) =>
  `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${domain}${proto(request) === 'https' ? '; Secure' : ''}`

export const clearedCookie = (request: Request) => {
  const domain = process.env.COOKIE_DOMAIN
  return domain ? [expired(request, `; Domain=${domain}`), expired(request, '')] : [expired(request, '')]
}

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
