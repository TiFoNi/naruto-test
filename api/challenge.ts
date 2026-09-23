import { challengeView, createChallenge, findChallenge, isCode } from './_lib/challenges.js'
import { fail, handle, json, readJson } from './_lib/http.js'
import { currentUser, unauthorized } from './_lib/profile.js'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const body = await readJson(request)

  if (body.action === 'create') {
    const made = await createChallenge(found.doc, body.game, body.mode, body.answerId)
    if (typeof made === 'string') return fail(made === 'server' ? 500 : 400, made)
    return json({ challenge: challengeView(made, found.doc._id!) })
  }

  if (body.action === 'view') {
    if (!isCode(body.code)) return fail(400, 'bad_request')
    const doc = await findChallenge(body.code)
    if (!doc) return fail(404, 'not_found')
    return json({ challenge: challengeView(doc, found.doc._id!) })
  }

  return fail(400, 'bad_action')
})
