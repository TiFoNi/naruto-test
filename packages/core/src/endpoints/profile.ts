import { fail, handle, json, readJson } from '../http'
import { quests, rounds, seasons } from '../db'
import { claimTag, currentUser, lowerNickname, parseNickname, toProfile, unauthorized } from '../profile'
import { isFrame } from '../frames'
import { GAME_IDS, profileBlocks } from '@nanda/game'

const SHOWCASE_MAX = 8
const BLOCK_MIN = 180
const BLOCK_MAX = 900

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

  if (body.action === 'showcase') {
    const asked = Array.isArray(body.showcase) ? body.showcase : null
    if (!asked) return fail(400, 'bad_request')
    const picked = [...new Set(asked.filter((id: unknown): id is string => typeof id === 'string' && (GAME_IDS as string[]).includes(id)))].slice(0, SHOWCASE_MAX)
    const doc = await found.collection.findOneAndUpdate({ _id: found.doc._id }, { $set: { showcase: picked } }, { returnDocument: 'after' })
    return json(toProfile(doc ?? found.doc))
  }

  if (body.action === 'blocks') {
    const picked = profileBlocks(body.blocks)
    if (!picked) return fail(400, 'bad_request')
    const sizes = Object.fromEntries(
      Object.entries((body.sizes ?? {}) as Record<string, unknown>)
        .filter(([block, size]) => picked.includes(block as never) && Number.isFinite(Number(size)))
        .map(([block, size]) => [block, Math.round(Math.min(BLOCK_MAX, Math.max(BLOCK_MIN, Number(size))))]),
    )
    const doc = await found.collection.findOneAndUpdate(
      { _id: found.doc._id },
      { $set: { blocks: picked, blockSizes: sizes } },
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
