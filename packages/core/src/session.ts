import { SignJWT, jwtVerify } from 'jose'

const GUEST = 'guest'
const MAX_AGE = 60 * 60 * 24 * 30

const cookieValue = (request: Request, name: string) =>
  request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1]

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

export async function guestCookie(request: Request, id: string) {
  const token = await new SignJWT({ guest: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret())
  return `${GUEST}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${attributes(request)}`
}

export async function readGuest(request: Request): Promise<string | null> {
  const token = cookieValue(request, GUEST)
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] })
    return payload.guest === true && payload.sub ? payload.sub : null
  } catch {
    return null
  }
}

