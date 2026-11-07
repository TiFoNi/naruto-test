import { handle, json } from '../http'
import { currentUser, unauthorized } from '../profile'
import { referralBoard } from '../referral'

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  return json(await referralBoard(found.doc))
})
