import type { ObjectId } from 'mongodb'
import { GAME_SPECS, ZOOM_LEVELS, type GameId } from '@nanda/game'
import { gameData } from '../games'
import { fail, handle } from '../http'
import { roundOwner } from '../profile'
import { abilityStageOf, findDuel, sideOf, wrongCount } from '../duels'
import { abilityStage, ownedRound, zoomStep } from '../rounds'
import { duelSeed, maskStage, roundSeed } from '../crop'
import { pageOf } from '../extra'

async function duelSource(code: string, userId: ObjectId) {
  const duel = await findDuel(code)
  const side = duel && sideOf(duel, userId)
  if (!duel || !side || duel.status === 'lobby' || duel.answerId === undefined) return null
  const revealed = duel.status === 'finished' || Boolean(side.solvedAt) || Boolean(side.gaveUp)
  return {
    game: duel.game,
    mode: duel.mode,
    answerId: duel.answerId,
    extra: duel.extra ?? undefined,
    stage: abilityStageOf(duel, side),
    step: revealed ? ZOOM_LEVELS.length - 1 : Math.min(wrongCount(duel, side), ZOOM_LEVELS.length - 1),
    seed: duelSeed(duel),
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
  const full = Buffer.from(await image.arrayBuffer())

  if (round.mode !== 'image') {
    return new Response(full, {
      headers: { 'content-type': 'image/webp', 'cache-control': round.mode === 'ability' || duelCode ? 'private, no-store' : 'private, max-age=86400' },
    })
  }

  const step = 'step' in round ? round.step : zoomStep(round)
  const seed = 'seed' in round ? round.seed : roundSeed(round)
  return new Response(await maskStage(full, seed, step), {
    headers: { 'content-type': 'image/webp', 'cache-control': 'private, no-store' },
  })
})
