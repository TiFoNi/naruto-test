import type { ObjectId } from 'mongodb'
import { GAME_SPECS, type GameId } from '../../src/games/specs.js'
import { fail, handle } from '../_lib/http.js'
import { sessionUserId, unauthorized } from '../_lib/profile.js'
import { abilityStageOf, findDuel, sideOf } from '../_lib/duels.js'
import { abilityStage, ownedRound } from '../_lib/rounds.js'

async function duelSource(code: string, userId: ObjectId) {
  const duel = await findDuel(code)
  const side = duel && sideOf(duel, userId)
  if (!duel || !side || duel.status === 'lobby' || duel.answerId === undefined) return null
  return {
    game: duel.game,
    mode: duel.mode,
    answerId: duel.answerId,
    extra: duel.extra ?? undefined,
    stage: abilityStageOf(duel, side),
  }
}

export const GET = handle(async (request) => {
  const userId = await sessionUserId(request)
  if (!userId) return unauthorized()
  const url = new URL(request.url)
  const duelCode = url.searchParams.get('duel')
  const round = duelCode ? await duelSource(duelCode, userId) : await ownedRound(userId, url.searchParams.get('id'))
  if (!round) return fail(404, 'not_found')
  const folder = GAME_SPECS[round.game as GameId].images
  const pics = process.env.PICS_URL?.replace(/\/+$/, '') ?? url.origin
  const source =
    round.mode === 'ability' && round.extra
      ? `${url.origin}/${folder}/abilities/${'stage' in round ? round.stage : abilityStage(round)}${round.extra}.webp`
      : `${pics}/${folder}/full/${round.answerId}.webp`
  const image = await fetch(source)
  if (!image.ok) return fail(502, 'server')
  return new Response(await image.arrayBuffer(), {
    headers: { 'content-type': 'image/webp', 'cache-control': round.mode === 'ability' || duelCode ? 'private, no-store' : 'private, max-age=86400' },
  })
})
