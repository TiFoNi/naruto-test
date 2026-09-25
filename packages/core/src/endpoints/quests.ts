import { users } from '../db'
import { fail, handle, json, readJson } from '../http'
import { currentUser, touchVisit, unauthorized } from '../profile'
import { claimQuest, questBoard } from '../quests'
import { levelOf, nextRank, rankOf, LEVEL_XP } from '../quests'
import { nextReset } from '../daily'

const standing = (xp: number) => {
  const level = levelOf(xp)
  return {
    xp,
    level,
    into: xp % LEVEL_XP,
    need: LEVEL_XP,
    rank: rankOf(level).id,
    next: nextRank(level),
  }
}

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const board = await questBoard(found.doc._id!)
  return json({ ...board, resetAt: nextReset(), ...standing(found.doc.xp ?? 0) })
})

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const { claim } = (await readJson(request)) as { claim?: unknown }
  if (typeof claim !== 'string') return fail(400, 'bad_request')

  const award = await claimQuest(found.doc._id!, claim)
  if (award === null) return fail(409, 'not_ready')
  await touchVisit(await users(), found.doc._id!)

  const xp = (found.doc.xp ?? 0) + award
  const board = await questBoard(found.doc._id!)
  return json({ ...board, resetAt: nextReset(), ...standing(xp), award })
})
