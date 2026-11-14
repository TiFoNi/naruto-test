import { ARENA_BAN_MARK, ARENA_GAMES, ARENA_SUMMON_MARK, ARENA_TIERS, type GameId } from '@nanda/game'
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
      locked: marks.includes(ARENA_BAN_MARK) || marks.includes(ARENA_SUMMON_MARK),
      edited: !!edits[String(one.id)],
    }
  })

  return json({ list, tiers: ARENA_TIERS })
})

export const POST = handle(async (request) => {
  if (!(await adminSession(request))) return missing()

  const body = (await readJson(request)) as { game?: unknown; id?: unknown; tier?: unknown; atk?: unknown; hp?: unknown; reset?: unknown }
  if (!playable(body.game)) return fail(400, 'bad_request')
  const id = whole(body.id, 1e9)
  if (id === null) return fail(400, 'bad_request')
  const collection = await entities()

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
