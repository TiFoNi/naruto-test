import { ARENA_GAMES, type GameId } from '@nanda/game'
import { arenaOf, arenaView, buyAndCast, buyAndPlay, buyCard, buySpell, castSpell, endTurn, inFight, tick, toggleAbility, moveCard, playCard, rollTavern, sellCard, startArena, upTavern } from '../arena'
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

  const ticked = tick(doc)
  const save = async () => {
    doc.updatedAt = new Date()
    await (await arenas()).replaceOne({ _id: userId }, doc)
  }

  if (action === 'state' || (action === 'end' && ticked)) {
    if (ticked) await save()
    return json({ arena: arenaView(doc) })
  }

  if (action === 'quit') {
    await (await arenas()).deleteOne({ _id: userId })
    return json({ arena: null })
  }

  if (doc.status !== 'playing') {
    if (ticked) await save()
    return json({ arena: arenaView(doc) })
  }

  if (inFight(doc)) {
    if (ticked) await save()
    return json({ arena: arenaView(doc) }, 409)
  }

  const act: Record<string, () => boolean> = {
    buy: () => (body.play ? buyAndPlay(doc, Number(body.at), body.to === undefined ? -1 : Number(body.to)) : buyCard(doc, Number(body.at))),
    spell: () => (body.target ? buyAndCast(doc, String(body.target)) : buySpell(doc)),
    cast: () => castSpell(doc, String(body.uid), String(body.target)),
    ability: () => toggleAbility(doc, String(body.uid), String(body.key), body.target === undefined ? undefined : String(body.target)),
    play: () => playCard(doc, String(body.uid), body.at === undefined ? -1 : Number(body.at)),
    sell: () => sellCard(doc, String(body.uid)),
    move: () => moveCard(doc, String(body.uid), Number(body.at)),
    roll: () => rollTavern(doc),
    up: () => upTavern(doc),
    end: () => Boolean(endTurn(doc)),
  }
  const run = act[String(action)]
  const done = run ? run() : null

  if (done === null) return fail(400, 'bad_request')
  if (!done) {
    if (ticked) await save()
    return json({ arena: arenaView(doc) }, 409)
  }

  await save()
  return json({ arena: arenaView(doc) })
})

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  if (!(await adminSession(request))) return fail(404, 'not_found')
  const doc = await arenaOf(found.doc._id!)
  if (doc && tick(doc)) {
    doc.updatedAt = new Date()
    await (await arenas()).replaceOne({ _id: found.doc._id! }, doc)
  }
  return json({ arena: doc ? arenaView(doc) : null })
})
