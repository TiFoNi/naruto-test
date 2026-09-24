import { entities } from '../db'
import { forget, isGame } from '../games'
import { fail, handle, json } from '../http'
import { adminSession } from '../admin'
import { dropPages, uploadPages, uploadPortrait } from '../images'

const LIMIT = 8 * 1024 * 1024
const MAX_PAGES = 12

type Upload = { size: number; arrayBuffer: () => Promise<ArrayBuffer> }

export const POST = handle(async (request) => {
  if (!(await adminSession(request))) return fail(404, 'not_found')

  const form = await request.formData().catch(() => null)
  if (!form) return fail(400, 'bad_request')

  const game = form.get('game')
  const id = Number(form.get('id'))
  const kind = form.get('kind')
  if (!isGame(game) || !Number.isInteger(id) || (kind !== 'portrait' && kind !== 'pages')) return fail(400, 'bad_request')

  const files = form
    .getAll('file')
    .filter((entry) => typeof entry !== 'string') as unknown as Upload[]
  if (!files.length || files.some((f) => !f.size)) return fail(400, 'no_file')
  if (files.length > MAX_PAGES) return fail(400, 'too_many')
  if (files.some((f) => f.size > LIMIT)) return fail(413, 'too_large')

  const collection = await entities()
  const found = await collection.findOne({ game, id })
  if (!found) return fail(404, 'not_found')

  const buffers = await Promise.all(files.map(async (file) => Buffer.from(await file.arrayBuffer())))

  const patch: Record<string, unknown> =
    kind === 'portrait'
      ? { image: await uploadPortrait(game, id, buffers[0]) }
      : await (async () => {
          const { count, version } = await uploadPages(game, id, buffers)
          const had = typeof found.pages === 'number' ? found.pages : 0
          if (had > count) await dropPages(game, id, count + 1, had)
          return { pages: count, image: version }
        })()

  await collection.updateOne({ game, id }, { $set: { ...patch, updatedAt: new Date() } })
  forget(game)

  const doc = await collection.findOne({ game, id }, { projection: { _id: 0, game: 0, updatedAt: 0 } })
  return json({ entity: doc })
})
