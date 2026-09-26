import { PHRASE_VOICE_AT, type GameId } from '@nanda/game'
import { GAME_SPECS } from '@nanda/game'
import { fail, handle } from '../http'
import { roundOwner } from '../profile'
import { ownedRound, phraseStep } from '../rounds'
import { phraseAt } from '../extra'

export const GET = handle(async (request) => {
  const userId = (await roundOwner(request)).id
  const url = new URL(request.url)
  const round = await ownedRound(userId, url.searchParams.get('id'))
  if (!round || round.mode !== 'phrase') return fail(404, 'not_found')

  const step = phraseStep(round)
  if (round.status === 'active' && step + 1 < PHRASE_VOICE_AT) return fail(403, 'locked')

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
