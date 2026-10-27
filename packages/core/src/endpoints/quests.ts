import { users } from '../db'
import { fail, handle, json, readJson } from '../http'
import { currentUser, touchVisit, unauthorized } from '../profile'
import { claimQuest, questBoard, swapQuest } from '../quests'
import { levelAt } from '@nanda/game'
import { nextReset } from '../daily'

const standing = (xp: number) => levelAt(xp)

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

  const paid = await claimQuest(found.doc._id!, claim)
  if (paid === null) return fail(409, 'not_ready')
  await touchVisit(await users(), found.doc._id!)

  const xp = (found.doc.xp ?? 0) + paid.xp
  const board = await questBoard(found.doc._id!)
  return json({ ...board, resetAt: nextReset(), ...standing(xp), award: paid.xp, coins: paid.coins })
})

export const SWAP = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const { swap } = (await readJson(request)) as { swap?: unknown }
  if (typeof swap !== 'string') return fail(400, 'bad_request')

  if (!(await swapQuest(found.doc._id!, swap))) return fail(409, 'not_ready')

  const board = await questBoard(found.doc._id!)
  return json({ ...board, resetAt: nextReset(), ...standing(found.doc.xp ?? 0) })
})
