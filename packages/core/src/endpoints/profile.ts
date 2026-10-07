import { fail, handle, json, readJson } from '../http'
import { quests, rounds, seasons } from '../db'
import { claimTag, currentUser, lowerNickname, parseNickname, toProfile, unauthorized } from '../profile'
import { isFrame } from '../frames'

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
        $unset: { stats: '', solvedTotal: '', duelStats: '', challengeStats: '', xp: '', xpToday: '', xpGain: '', awards: '', awardsSolved: '', awardsAt: '', claimed: '', pinned: '', visit: '', tally: '' },
        $set: { resetAt: new Date() },
      },
      { returnDocument: 'after' },
    )
    return json(toProfile(doc ?? found.doc))
  }

  if (body.action === 'nickname') {
    const nickname = parseNickname(body.nickname)
    if (!nickname) return fail(400, 'invalid_nickname')
    const lower = lowerNickname(nickname)
    const doc = await found.collection.findOneAndUpdate({ _id: found.doc._id }, { $set: { nickname, nicknameLower: lower } }, { returnDocument: 'after' })
    const tag = await claimTag(found.collection, found.doc._id!, lower, doc?.tag ?? found.doc.tag)
    return json(toProfile({ ...(doc ?? found.doc), tag: tag ?? undefined }))
  }

  if (body.action === 'frame') {
    const frame = body.frame ?? null
    if (frame !== null && !isFrame(frame)) return fail(400, 'bad_request')
    if (frame !== null && !(found.doc.frames ?? []).includes(frame)) return fail(403, 'locked')

    const doc = await found.collection.findOneAndUpdate(
      { _id: found.doc._id },
      frame === null ? { $unset: { frame: '' } } : { $set: { frame } },
      { returnDocument: 'after' },
    )
    return json(toProfile(doc ?? found.doc))
  }

  if (body.action === 'seenFrames') {
    const owned = found.doc.frames ?? []
    if (!owned.length) return json(toProfile(found.doc))
    const doc = await found.collection.findOneAndUpdate(
      { _id: found.doc._id },
      { $addToSet: { framesSeen: { $each: owned } } },
      { returnDocument: 'after' },
    )
    return json(toProfile(doc ?? found.doc))
  }

  return fail(400, 'bad_request')
})
