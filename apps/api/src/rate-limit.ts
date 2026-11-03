import type { NextFunction, Request, Response } from 'express'

const WINDOW_MS = 10_000
const PER_VISITOR = 150
const PER_HOP = 6_000
const SKIP = ['/api/shop/telegram']

const SESSION = /(?:^|;\s*)(?:__Secure-)?nanda\.session_token=([^;]+)/
const GUEST = /(?:^|;\s*)guest=([^;]+)/

let visitors = new Map<string, number>()
let hops = new Map<string, number>()

setInterval(() => {
  visitors = new Map()
  hops = new Map()
}, WINDOW_MS).unref()

const firstForwarded = (req: Request) => {
  const raw = req.headers['x-forwarded-for']
  const list = Array.isArray(raw) ? raw.join(',') : raw ?? ''
  return list.split(',')[0]?.trim() || null
}

export const visitorOf = (req: Request) => {
  const cookie = req.headers.cookie ?? ''
  const token = cookie.match(SESSION)?.[1] ?? cookie.match(GUEST)?.[1]
  if (token) return `t:${token}`
  return `ip:${firstForwarded(req) ?? req.ip ?? 'unknown'}`
}

const bump = (map: Map<string, number>, key: string) => {
  const count = (map.get(key) ?? 0) + 1
  map.set(key, count)
  return count
}

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS' || SKIP.some((path) => req.path.startsWith(path))) return next()
  const hop = bump(hops, req.ip ?? 'unknown')
  const visitor = bump(visitors, visitorOf(req))
  if (hop <= PER_HOP && visitor <= PER_VISITOR) return next()
  res.setHeader('retry-after', String(Math.ceil(WINDOW_MS / 1000)))
  res.status(429).json({ error: 'too_fast' })
}
