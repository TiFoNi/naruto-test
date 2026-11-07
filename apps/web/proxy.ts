import { NextResponse, type NextRequest } from 'next/server'
import { LANGS, type Lang } from '@/src/i18n/ui'

const CODES = LANGS.map(({ id }) => id)
const DEFAULT: Lang = 'ru'
const REF_COOKIE = 'nanda_ref'
const REF_SHAPE = /^[A-Z2-9]{7}$/
const REF_DAYS = 30

const refDomain = (request: NextRequest) => {
  if (process.env.COOKIE_DOMAIN) return process.env.COOKIE_DOMAIN
  const raw = request.headers.get('x-forwarded-host')?.split(',')[0] ?? request.headers.get('host') ?? request.nextUrl.host
  const host = raw.trim().toLowerCase().replace(/:\d+$/, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return undefined
  return host.replace(/^www\./, '')
}

function preferred(request: NextRequest): Lang {
  const stored = request.cookies.get('lang')?.value
  if (CODES.includes(stored as Lang)) return stored as Lang

  const header = request.headers.get('accept-language')?.toLowerCase() ?? ''
  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim()
    if (tag.startsWith('uk')) return 'uk'
    if (tag.startsWith('ru')) return 'ru'
    if (tag.startsWith('en')) return 'en'
  }
  return DEFAULT
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const ref = url.searchParams.get('ref')
  const known = CODES.some((code) => url.pathname === `/${code}` || url.pathname.startsWith(`/${code}/`))
  if (known && ref === null) return NextResponse.next()

  url.searchParams.delete('ref')
  if (!known) url.pathname = `/${preferred(request)}${url.pathname === '/' ? '' : url.pathname}`
  const response = NextResponse.redirect(url)
  if (!known) response.headers.set('vary', 'Accept-Language, Cookie')

  const code = ref?.trim().toUpperCase() ?? ''
  if (REF_SHAPE.test(code)) {
    response.cookies.set(REF_COOKIE, code, { path: '/', domain: refDomain(request), maxAge: REF_DAYS * 86_400, httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:' })
  }
  return response
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
}
