import { ARENA_BAN_MARK, ARENA_BUM, ARENA_GAMES, ARENA_PARKED, ARENA_SUMMON_MARK, ARENA_TIERS, type GameId } from '@nanda/game'
import { arenaSheet, forgetArenaSheet, loadArenaSheet, tierOf } from '../arena'
import { entities } from '../db'
import { isGame } from '../games'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'

const missing = () => fail(404, 'not_found')

const playable = (game: unknown): game is GameId => isGame(game) && ARENA_GAMES.includes(game)

const whole = (value: unknown, top: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= top ? value : null

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const game = new URL(request.url).searchParams.get('game')
  if (!playable(game)) return fail(400, 'bad_request')
  forgetArenaSheet()
  await loadArenaSheet(game)
  const { book, edits } = arenaSheet()

  const rows = await (await entities())
    .find({ game, hidden: { $ne: true } }, { projection: { _id: 0, id: 1, name: 1, nameEn: 1, image: 1, thumb: 1, attributes: 1 }, sort: { id: 1 } })
    .toArray()

  const list = rows.map((row) => {
    const one = row as unknown as { id: number; attributes?: string[] }
    const marks = one.attributes ?? []
    const cell = edits[String(one.id)] ?? book[String(one.id)] ?? [2, 4, 4]
    return {
      ...row,
      tier: cell[0],
      atk: cell[1],
      hp: cell[2],
      locked: marks.includes(ARENA_BAN_MARK) || marks.includes(ARENA_SUMMON_MARK) || (ARENA_PARKED[game] ?? []).includes(one.id),
      edited: !!edits[String(one.id)],
    }
  })

  return json({ list, tiers: ARENA_TIERS })
})

export const POST = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const body = (await readJson(request)) as { game?: unknown; id?: unknown; tier?: unknown; atk?: unknown; hp?: unknown; reset?: unknown; unpark?: unknown }
  if (!playable(body.game)) return fail(400, 'bad_request')
  const collection = await entities()

  if (body.unpark) {
    forgetArenaSheet()
    await loadArenaSheet(body.game)
    const { book, edits } = arenaSheet()
    const parked = ARENA_PARKED[body.game] ?? []
    const rows = await collection
      .find({ game: body.game, hidden: { $ne: true } }, { projection: { _id: 0, id: 1, attributes: 1 } })
      .toArray()
    const lift = rows
      .map((row) => row as unknown as { id: number; attributes?: string[] })
      .filter((row) => {
        const marks = row.attributes ?? []
        if (marks.includes(ARENA_BAN_MARK) || marks.includes(ARENA_SUMMON_MARK) || parked.includes(row.id)) return false
        const cell = edits[String(row.id)] ?? book[String(row.id)]
        return (cell?.[0] ?? 2) === 0
      })
      .map((row) => row.id)
    const back = lift.filter((one) => (book[String(one)]?.[0] ?? 0) > 0)
    const bum = lift.filter((one) => !back.includes(one))
    if (back.length) await collection.updateMany({ game: body.game, id: { $in: back } }, { $unset: { arena: '' }, $set: { updatedAt: new Date() } })
    if (bum.length) await collection.updateMany({ game: body.game, id: { $in: bum } }, { $set: { arena: [...ARENA_BUM], updatedAt: new Date() } })
    forgetArenaSheet()
    await loadArenaSheet(body.game)
    return json({ lifted: lift.length })
  }

  const id = whole(body.id, 1e9)
  if (id === null) return fail(400, 'bad_request')

  if (body.reset) {
    const cleared = await collection.updateOne({ game: body.game, id }, { $unset: { arena: '' }, $set: { updatedAt: new Date() } })
    if (!cleared.matchedCount) return missing()
    forgetArenaSheet()
    await loadArenaSheet(body.game)
    return json({ id, tier: tierOf(id) })
  }

  const tier = whole(body.tier, ARENA_TIERS)
  const atk = whole(body.atk, 99)
  const hp = whole(body.hp, 99)
  if (tier === null || atk === null || hp === null) return fail(400, 'bad_request')

  const saved = await collection.updateOne({ game: body.game, id }, { $set: { arena: [tier, atk, hp], updatedAt: new Date() } })
  if (!saved.matchedCount) return missing()

  forgetArenaSheet()
  await loadArenaSheet(body.game)
  return json({ id, tier, atk, hp })
})
