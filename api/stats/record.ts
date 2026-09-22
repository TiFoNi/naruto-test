import { fail, handle, json, readJson } from '../_lib/http.js'
import { STAT_KEYS, currentUser, normalizeStats, unauthorized } from '../_lib/profile.js'

const orZero = (path: string) => ({ $ifNull: [`$${path}`, 0] })

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const body = await readJson(request)
  const key = `${body.game}_${body.mode}`
  const guesses = Number(body.guesses)
  if (!STAT_KEYS.includes(key) || typeof body.won !== 'boolean' || !Number.isInteger(guesses) || guesses < 1 || guesses > 1000) {
    return fail(400, 'bad_result')
  }

  const path = `stats.${key}`
  const update = body.won
    ? [
        {
          $set: {
            [path]: {
              solved: { $add: [orZero(`${path}.solved`), 1] },
              streak: { $add: [orZero(`${path}.streak`), 1] },
              best: { $max: [orZero(`${path}.best`), { $add: [orZero(`${path}.streak`), 1] }] },
              totalGuesses: { $add: [orZero(`${path}.totalGuesses`), guesses] },
            },
          },
        },
      ]
    : { $set: { [`${path}.streak`]: 0 } }

  const doc = await found.collection.findOneAndUpdate({ _id: found.doc._id }, update, { returnDocument: 'after' })
  return json({ key, stats: normalizeStats(doc?.stats?.[key]) })
})
