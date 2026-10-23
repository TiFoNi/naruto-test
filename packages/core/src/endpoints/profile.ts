import { fail, handle, json, readJson } from '../http'
import { quests, rounds, seasons, shotDays, shotRuns, streaks, tuneRuns } from '../db'
import { claimTag, currentUser, lowerNickname, ownedTitles, parseNickname, toProfile, unauthorized } from '../profile'
import { isFrame } from '../frames'
import { GAME_IDS, bannerCost, bundleOf, frameCost, heroTiles, isBanner, isTitle, isTone, profileBlocks } from '@nanda/game'

const SHOWCASE_MAX = 8
const BLOCK_MIN = 60
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
      (await streaks()).deleteMany({ userId }),
      (await shotRuns()).deleteMany({ userId }),
      (await shotDays()).deleteMany({ userId }),
      (await tuneRuns()).deleteMany({ userId }),
    ])
    const doc = await found.collection.findOneAndUpdate(
      { _id: userId },
      {
        $unset: { stats: '', solvedTotal: '', duelStats: '', duelLog: '', duelBestMs: '', duelComeback: '', challengeStats: '', xp: '', xpToday: '', xpGain: '', awards: '', awardsSolved: '', awardsAt: '', claimed: '', pinned: '', visit: '', tally: '', langs: '' },
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
    const doc = await found.collection.findOneAndUpdate(
      { _id: found.doc._id },
      { $set: { nickname, nicknameLower: lower, named: true } },
      { returnDocument: 'after' },
    )
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

  if (body.action === 'title') {
    const asked = body.title
    if (asked !== null && !isTitle(asked)) return fail(400, 'bad_request')
    if (asked !== null && !ownedTitles(found.doc).includes(asked)) return fail(403, 'not_yours')

    const doc = await found.collection.findOneAndUpdate(
      { _id: found.doc._id },
      asked === null ? { $unset: { title: '' } } : { $set: { title: asked } },
      { returnDocument: 'after' },
    )
    return json(toProfile(doc ?? found.doc))
  }

  if (body.action === 'nickTone') {
    const asked = body.nickTone
    if (asked !== null && !isTone(asked)) return fail(400, 'bad_request')

    const doc = await found.collection.findOneAndUpdate(
      { _id: found.doc._id },
      asked === null ? { $unset: { nickTone: '' } } : { $set: { nickTone: asked } },
      { returnDocument: 'after' },
    )
    return json(toProfile(doc ?? found.doc))
  }

  if (body.action === 'tone') {
    const asked = body.tone
    if (asked !== null && !isTone(asked)) return fail(400, 'bad_request')

    const doc = await found.collection.findOneAndUpdate(
      { _id: found.doc._id },
      asked === null ? { $unset: { tone: '' } } : { $set: { tone: asked } },
      { returnDocument: 'after' },
    )
    return json(toProfile(doc ?? found.doc))
  }

  if (body.action === 'banner') {
    const asked = body.banner
    if (asked !== null && !isBanner(asked)) return fail(400, 'bad_request')
    if (asked !== null && !(found.doc.banners ?? []).includes(asked)) return fail(403, 'locked')

    const doc = await found.collection.findOneAndUpdate(
      { _id: found.doc._id },
      asked === null ? { $unset: { banner: '' } } : { $set: { banner: asked } },
      { returnDocument: 'after' },
    )
    return json(toProfile(doc ?? found.doc))
  }

  if (body.action === 'buy') {
    const mineFrames = found.doc.frames ?? []
    const mineBanners = found.doc.banners ?? []
    const bundle = body.kind === 'bundle' ? bundleOf(body.id) : null
    const frame = body.kind === 'frame' ? (typeof body.id === 'string' ? body.id : null) : (bundle?.frame ?? null)
    const banner = body.kind === 'banner' ? (typeof body.id === 'string' ? body.id : null) : (bundle?.banner ?? null)

    const cost = bundle ? bundle.cost : body.kind === 'frame' ? frameCost(frame) : body.kind === 'banner' ? bannerCost(banner) : null
    if (!cost) return fail(400, 'bad_request')
    if ((frame && mineFrames.includes(frame)) || (banner && mineBanners.includes(banner))) return fail(409, 'owned')

    const doc = await found.collection.findOneAndUpdate(
      { _id: found.doc._id, coins: { $gte: cost } },
      {
        $inc: { coins: -cost },
        ...(frame || banner
          ? { $addToSet: { ...(frame ? { frames: frame } : {}), ...(banner ? { banners: banner } : {}) } }
          : {}),
      },
      { returnDocument: 'after' },
    )
    if (!doc) return fail(409, 'no_coins')
    return json(toProfile(doc))
  }

  if (body.action === 'tiles') {
    const picked = heroTiles(body.tiles)
    if (!picked) return fail(400, 'bad_request')
    const doc = await found.collection.findOneAndUpdate({ _id: found.doc._id }, { $set: { tiles: picked } }, { returnDocument: 'after' })
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
    const sides = Object.fromEntries(
      Object.entries((body.sides ?? {}) as Record<string, unknown>)
        .filter(([block, side]) => picked.includes(block as never) && (Number(side) === 0 || Number(side) === 1))
        .map(([block, side]) => [block, Number(side)]),
    )
    const seen = Object.fromEntries(
      Object.entries((body.seen ?? {}) as Record<string, unknown>)
        .filter(([block, count]) => picked.includes(block as never) && Number.isFinite(Number(count)) && Number(count) > 0)
        .map(([block, count]) => [block, Math.round(Math.min(64, Number(count)))]),
    )
    const doc = await found.collection.findOneAndUpdate(
      { _id: found.doc._id },
      { $set: { blocks: picked, blockSizes: sizes, blockSides: sides, blockSeen: seen } },
      { returnDocument: 'after' },
    )
    return json(toProfile(doc ?? found.doc))
  }

  if (body.action === 'seenCoins') {
    const doc = await found.collection.findOneAndUpdate({ _id: found.doc._id }, { $unset: { coinsNews: '' } }, { returnDocument: 'after' })
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
