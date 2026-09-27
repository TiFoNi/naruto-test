import { PHRASE_VOICE_AT, type GameId } from '@nanda/game'
import { GAME_SPECS } from '@nanda/game'
import { fail, handle } from '../http'
import { roundOwner } from '../profile'
import { ownedRound, phraseStep } from '../rounds'
import { phraseAt, phraseCount } from '../extra'
import { findDuel, sideOf, wrongCount } from '../duels'
import { PHRASE_EVERY } from '@nanda/game'
import type { ObjectId } from 'mongodb'

async function duelSource(code: string, userId: ObjectId) {
  const duel = await findDuel(code)
  const side = duel && sideOf(duel, userId)
  if (!duel || !side || duel.status === 'lobby' || duel.answerId === undefined || duel.mode !== 'phrase') return null

  const total = phraseCount(duel.answerId)
  const step = total ? Math.min(Math.floor(wrongCount(duel, side) / PHRASE_EVERY), total - 1) : 0
  const open = duel.status !== 'playing' || Boolean(side.solvedAt) || Boolean(side.gaveUp)
  return { game: duel.game, mode: duel.mode, answerId: duel.answerId, extra: duel.extra ?? undefined, step, open }
}

export const GET = handle(async (request) => {
  const userId = (await roundOwner(request)).id
  const url = new URL(request.url)
  const duelCode = url.searchParams.get('duel')
  const round = duelCode ? await duelSource(duelCode, userId) : await ownedRound(userId, url.searchParams.get('id'))
  if (!round || round.mode !== 'phrase') return fail(404, 'not_found')

  const step = 'step' in round ? round.step : phraseStep(round)
  const unlocked = 'open' in round ? round.open || step + 1 >= PHRASE_VOICE_AT : round.status !== 'active' || step + 1 >= PHRASE_VOICE_AT
  if (!unlocked) return fail(403, 'locked')

  const index = Number(url.searchParams.get('i') ?? 0)
  if (!Number.isInteger(index) || index < 0 || index > step) return fail(403, 'locked')

  const line = phraseAt(round.answerId, round.extra, index)
  if (!line) return fail(404, 'not_found')

  const folder = GAME_SPECS[round.game as GameId].images
  const pics = process.env.PICS_URL?.replace(/\/+$/, '') ?? url.origin
  const clip = await fetch(`${pics}/${folder}/voice/${round.answerId}/${line.clip}.mp3`)
  if (!clip.ok) return fail(502, 'server')

  return new Response(await clip.arrayBuffer(), {
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, no-store' },
  })
})
