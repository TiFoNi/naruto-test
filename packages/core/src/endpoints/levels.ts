import { users } from '../db'
import { fail, handle, json, readJson } from '../http'
import { currentUser, touchVisit, unauthorized } from '../profile'
import { claimLevel } from '../levels'
import { levelOf, LEVEL_XP } from '../quests'

const standing = (xp: number) => ({ xp, level: levelOf(xp), into: xp % LEVEL_XP, need: LEVEL_XP })

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  return json({
    ...standing(found.doc.xp ?? 0),
    purse: found.doc.coins ?? 0,
    taken: found.doc.levelsTaken ?? [],
  })
})

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const { level } = (await readJson(request)) as { level?: unknown }
  const paid = await claimLevel(found.doc._id!, level)
  if (!paid) return fail(409, 'not_ready')
  await touchVisit(await users(), found.doc._id!)

  return json({ ...standing(found.doc.xp ?? 0), purse: paid.purse, taken: paid.taken, award: paid.coins })
})
