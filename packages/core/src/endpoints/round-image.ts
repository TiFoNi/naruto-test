import type { ObjectId } from 'mongodb'
import { GAME_SPECS, type GameId } from '@nanda/game'
import { gameData } from '../games'
import { fail, handle } from '../http'
import { roundOwner } from '../profile'
import { abilityStageOf, findDuel, sideOf } from '../duels'
import { abilityStage, ownedRound } from '../rounds'
import { pageOf } from '../extra'

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
  const userId = (await roundOwner(request)).id
  const url = new URL(request.url)
  const duelCode = url.searchParams.get('duel')
  const round = duelCode ? await duelSource(duelCode, userId) : await ownedRound(userId, url.searchParams.get('id'))
  if (!round) return fail(404, 'not_found')
  const folder = GAME_SPECS[round.game as GameId].images
  const pics = process.env.PICS_URL?.replace(/\/+$/, '') ?? url.origin
  const site = (process.env.SITE_URL ?? process.env.CORS_ORIGINS?.split(',')[0] ?? url.origin).trim().replace(/\/+$/, '')
  const entity = (await gameData(round.game as GameId)).byId.get(round.answerId)
  const tag = typeof entity?.image === 'string' ? `?v=${entity.image}` : ''
  const source =
    round.mode === 'ability' && round.extra
      ? `${site}/${folder}/abilities/${'stage' in round ? round.stage : abilityStage(round)}${round.extra}.webp`
      : round.mode === 'page'
        ? `${pics}/${folder}/pages/${round.answerId}/${pageOf(round.extra)}.webp${tag}`
        : `${pics}/${folder}/full/${round.answerId}.webp${tag}`
  const image = await fetch(source)
  if (!image.ok) return fail(502, 'server')
  return new Response(await image.arrayBuffer(), {
    headers: { 'content-type': 'image/webp', 'cache-control': round.mode === 'ability' || duelCode ? 'private, no-store' : 'private, max-age=86400' },
  })
})
