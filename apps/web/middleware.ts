import { NextResponse, type NextRequest } from 'next/server'
import { LANGS, type Lang } from '@/src/i18n/ui'

const CODES = LANGS.map(({ id }) => id)
const DEFAULT: Lang = 'ru'

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

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (CODES.some((code) => pathname === `/${code}` || pathname.startsWith(`/${code}/`))) return NextResponse.next()

  const lang = preferred(request)
  const response = NextResponse.redirect(new URL(`/${lang}${pathname === '/' ? '' : pathname}${search}`, request.url))
  response.headers.set('vary', 'Accept-Language, Cookie')
  return response
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
}
