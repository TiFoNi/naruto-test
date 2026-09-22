import { attempts } from './db.js'

const WINDOW_MS = 15 * 60 * 1000

export const clientIp = (request: Request) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'

export async function tooMany(keys: string[], limit: number) {
  const collection = await attempts()
  const since = new Date(Date.now() - WINDOW_MS)
  const counts = await Promise.all(keys.map((key) => collection.countDocuments({ key, at: { $gte: since } })))
  return counts.some((count) => count >= limit)
}

export async function remember(keys: string[]) {
  const collection = await attempts()
  const at = new Date()
  await collection.insertMany(keys.map((key) => ({ key, at })))
}
