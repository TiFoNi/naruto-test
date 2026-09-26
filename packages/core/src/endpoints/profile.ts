import { fail, handle, json, readJson } from '../http'
import { quests, rounds, seasons } from '../db'
import { currentUser, parseNickname, toProfile, unauthorized } from '../profile'

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const body = await readJson(request)

  if (body.action === 'reset') {
    const userId = found.doc._id!
    await Promise.all([
      (await quests()).deleteMany({ userId }),
      (await rounds()).deleteMany({ userId }),
      (await seasons()).deleteMany({ userId }),
    ])
    const doc = await found.collection.findOneAndUpdate(
      { _id: userId },
      {
        $unset: { stats: '', duelStats: '', challengeStats: '', xp: '', awards: '', claimed: '', pinned: '', visit: '' },
        $set: { resetAt: new Date() },
      },
      { returnDocument: 'after' },
    )
    return json(toProfile(doc ?? found.doc))
  }

  if (body.action === 'nickname') {
    const nickname = parseNickname(body.nickname)
    if (!nickname) return fail(400, 'invalid_nickname')
    const doc = await found.collection.findOneAndUpdate({ _id: found.doc._id }, { $set: { nickname } }, { returnDocument: 'after' })
    return json(toProfile(doc ?? found.doc))
  }

  return fail(400, 'bad_request')
})
