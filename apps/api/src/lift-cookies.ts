import type { NextFunction, Request, Response } from 'express'

const MOVED = 'nanda_dom'
const NAMES = /(?:^|;\s*)((?:__Secure-)?nanda\.session_token|guest)=([^;]+)/g
const SESSION_AGE = 60 * 60 * 24 * 30
const FLAG_AGE = 60 * 60 * 24 * 365

const secure = (req: Request) => req.secure || req.headers['x-forwarded-proto']?.toString().split(',')[0]?.trim() === 'https'

export function liftCookies(req: Request, res: Response, next: NextFunction) {
  const domain = process.env.COOKIE_DOMAIN
  const cookie = req.headers.cookie ?? ''
  if (!domain || !cookie || new RegExp(`(?:^|;\\s*)${MOVED}=1`).test(cookie)) return next()

  const found = [...cookie.matchAll(NAMES)]
  if (!found.length) return next()

  const tail = `; Path=/; HttpOnly; SameSite=Lax${secure(req) ? '; Secure' : ''}`
  for (const [, name, value] of found) {
    res.append('set-cookie', `${name}=; Max-Age=0${tail}`)
    res.append('set-cookie', `${name}=${value}; Max-Age=${SESSION_AGE}; Domain=${domain}${tail}`)
  }
  res.append('set-cookie', `${MOVED}=1; Max-Age=${FLAG_AGE}; Domain=${domain}; Path=/; SameSite=Lax${secure(req) ? '; Secure' : ''}`)
  next()
}
