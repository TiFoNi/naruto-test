import { settings } from '../db'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'

const SLOT = 'frames'

const fit = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback

const clean = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return null
  const out: Record<string, { scale: number; x: number; y: number; cut: number; cx: number; cy: number }> = {}
  for (const [id, one] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-z0-9-]{1,24}$/.test(id) || !one || typeof one !== 'object') continue
    const tune = one as Record<string, unknown>
    out[id] = {
      scale: fit(tune.scale, 0.5, 3, 1.22),
      x: fit(tune.x, -40, 40, 0),
      y: fit(tune.y, -40, 40, 0),
      cut: fit(tune.cut, 30, 100, 100),
      cx: fit(tune.cx, -40, 40, 0),
      cy: fit(tune.cy, -40, 40, 0),
    }
  }
  return out
}

export const GET = handle(async () => {
  const doc = await (await settings()).findOne({ game: SLOT }, { projection: { _id: 0, tune: 1 } })
  return json({ tune: doc?.tune ?? {} })
})

export const POST = handle(async (request) => {
  if (!(await adminSession(request))) return fail(404, 'not_found')

  const { tune } = (await readJson(request)) as { tune?: unknown }
  const picked = clean(tune)
  if (!picked) return fail(400, 'bad_request')

  await (await settings()).updateOne({ game: SLOT }, { $set: { tune: picked } }, { upsert: true })
  return json({ tune: picked })
})
