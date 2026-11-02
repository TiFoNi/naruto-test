import { fail, handle, json, readJson } from '../http'
import { verifyHuman } from '../human'
import { currentUser, unauthorized } from '../profile'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const { token } = await readJson(request)
  if (typeof token !== 'string' || !token) return fail(400, 'bad_request')
  return (await verifyHuman(found.doc._id!, token)) ? json({ ok: true }) : fail(400, 'human_failed')
})
