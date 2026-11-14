import { ARENA_GAMES, type GameId } from '@nanda/game'
import { arenaOf, arenaView, buyCard, endTurn, moveCard, playCard, sellCard, startArena } from '../arena'
import { arenas } from '../db'
import { isGame } from '../games'
import { fail, handle, json, readJson } from '../http'
import { adminSession } from '../admin'
import { currentUser, unauthorized } from '../profile'

const playable = (game: unknown): game is GameId => isGame(game) && ARENA_GAMES.includes(game)

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  if (!(await adminSession(request))) return fail(404, 'not_found')
  const userId = found.doc._id!
  const body = await readJson(request)
  const { action } = body

  if (action === 'start') {
    const game = body.game
    if (!playable(game)) return fail(400, 'bad_request')
    const doc = await startArena(userId, game)
    return doc ? json({ arena: arenaView(doc) }) : fail(400, 'not_ready')
  }

  const doc = await arenaOf(userId)
  if (!doc) return fail(404, 'not_found')

  if (action === 'state') return json({ arena: arenaView(doc) })

  if (action === 'quit') {
    await (await arenas()).deleteOne({ _id: userId })
    return json({ arena: null })
  }

  if (doc.status !== 'playing') return json({ arena: arenaView(doc) })

  const act: Record<string, () => boolean> = {
    buy: () => buyCard(doc, Number(body.at)),
    play: () => playCard(doc, String(body.uid)),
    sell: () => sellCard(doc, String(body.uid)),
    move: () => moveCard(doc, String(body.uid), Number(body.at)),
    end: () => Boolean(endTurn(doc)),
  }
  const run = act[String(action)]
  const done = run ? run() : null

  if (done === null) return fail(400, 'bad_request')
  if (!done) return json({ arena: arenaView(doc) }, 409)

  doc.updatedAt = new Date()
  await (await arenas()).replaceOne({ _id: userId }, doc)
  return json({ arena: arenaView(doc) })
})

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  if (!(await adminSession(request))) return fail(404, 'not_found')
  const doc = await arenaOf(found.doc._id!)
  return json({ arena: doc ? arenaView(doc) : null })
})
