import { ObjectId } from 'mongodb'
import { fail, handle, json, readJson } from '../http'
import { currentUser, unauthorized } from '../profile'
import { dropPushSub, hasPushSub, pushKey, savePushSub } from '../push'

type Body = {
  action?: unknown
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  return json({ key: pushKey(), on: await hasPushSub(found.doc._id!) })
})

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const body = (await readJson(request)) as Body
  const userId = found.doc._id as ObjectId
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''

  if (body.action === 'off') {
    await dropPushSub(userId, endpoint || undefined)
    return json({ on: false })
  }

  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''
  if (!endpoint || !p256dh || !auth) return fail(400, 'bad_request')

  await savePushSub(userId, endpoint, { p256dh, auth })
  return json({ on: true })
})
