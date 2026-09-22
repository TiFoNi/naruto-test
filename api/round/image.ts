import { GAME_SPECS, type GameId } from '../../src/games/specs.js'
import { fail, handle } from '../_lib/http.js'
import { sessionUserId, unauthorized } from '../_lib/profile.js'
import { abilityStage, ownedRound } from '../_lib/rounds.js'

export const GET = handle(async (request) => {
  const userId = await sessionUserId(request)
  if (!userId) return unauthorized()
  const url = new URL(request.url)
  const round = await ownedRound(userId, url.searchParams.get('id'))
  if (!round) return fail(404, 'not_found')
  const folder = GAME_SPECS[round.game as GameId].images
  const source =
    round.mode === 'ability' && round.extra
      ? `${url.origin}/${folder}/abilities/${abilityStage(round)}${round.extra}.webp`
      : `${url.origin}/${folder}/full/${round.answerId}.webp`
  const image = await fetch(source)
  if (!image.ok) return fail(502, 'server')
  return new Response(await image.arrayBuffer(), {
    headers: { 'content-type': 'image/webp', 'cache-control': round.mode === 'ability' ? 'private, no-store' : 'private, max-age=86400' },
  })
})
