import { DUST_CRAFT, SHARDS_DAY, HUNT_MAX, HUNT_PITY, dustFor, shardGame, type GameId } from '@nanda/game'
import { craftCard, gradeOf, huntOf, raiseCard, scrapCard, setHunt, shardRoom } from '../bestiary'
import { cards, users } from '../db'
import { isGame } from '../games'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'
import { currentUser, unauthorized } from '../profile'

const game = (value: unknown): value is GameId => isGame(value)

const stateOf = async (userId: Parameters<typeof huntOf>[0], where: GameId) => {
  const [doc, list, hunt] = await Promise.all([
    (await users()).findOne({ _id: userId }, { projection: { dust: 1, pity: 1 } }),
    (await cards())
      .find({ userId, game: where }, { projection: { entityId: 1, rank: 1, shards: 1, craft: 1, xp: 1 } })
      .toArray(),
    huntOf(userId, where),
  ])
  const room = await shardRoom(userId, where)
  return {
    dust: doc?.dust?.[where] ?? 0,
    hunt,
    shards: { got: room.got, max: SHARDS_DAY },
    pity: { now: Math.min(HUNT_PITY, doc?.pity?.[where] ?? 0), max: HUNT_PITY },
    cards: Object.fromEntries(
      list.map((one) => {
        const grade = gradeOf(one)
        return [
          one.entityId,
          {
            rank: grade.rank,
            rarity: grade.rarity,
            shards: grade.shards,
            up: grade.up,
            power: grade.power,
            spare: grade.spare,
            ready: grade.ready,
            craft: { price: DUST_CRAFT, back: dustFor(grade.shards), spare: dustFor(grade.spare) },
          },
        ]
      }),
    ),
  }
}

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  if (!(await adminSession(request))) return fail(404, 'not_found')
  const where = new URL(request.url).searchParams.get('game')
  if (!game(where)) return fail(400, 'bad_request')
  if (!shardGame(where)) return fail(404, 'not_found')
  return json({ bestiary: await stateOf(found.doc._id!, where) })
})

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  if (!(await adminSession(request))) return fail(404, 'not_found')
  const userId = found.doc._id!
  const body = (await readJson(request)) as { game?: unknown; action?: unknown; id?: unknown; ids?: unknown; n?: unknown }
  const where = body.game
  if (!game(where)) return fail(400, 'bad_request')
  if (!shardGame(where)) return fail(404, 'not_found')
  const id = Number(body.id)

  if (body.action === 'hunt') {
    const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isInteger).slice(0, HUNT_MAX) : []
    await setHunt(userId, where, ids)
    return json({ bestiary: await stateOf(userId, where) })
  }

  if (!Number.isInteger(id)) return fail(400, 'bad_request')

  const act =
    body.action === 'raise'
      ? await raiseCard(userId, where, id)
      : body.action === 'scrap'
        ? await scrapCard(userId, where, id, Number(body.n) || 0)
        : body.action === 'craft'
          ? await craftCard(userId, where, id, Number(body.n) || 1)
          : null

  if (!act) return fail(400, 'bad_request')
  if (!act.ok) return json({ error: act.why, bestiary: await stateOf(userId, where) }, 409)
  return json({ bestiary: await stateOf(userId, where) })
})
