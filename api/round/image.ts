import { GAME_SPECS, type GameId } from '../../src/games/specs.js'
import { fail, handle } from '../_lib/http.js'
import { currentUser, unauthorized } from '../_lib/profile.js'
import { ownedRound } from '../_lib/rounds.js'

export const GET = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const url = new URL(request.url)
  const round = await ownedRound(found.doc._id!, url.searchParams.get('id'))
  if (!round) return fail(404, 'not_found')
  const source = `${url.origin}/${GAME_SPECS[round.game as GameId].images}/full/${round.answerId}.webp`
  const image = await fetch(source)
  if (!image.ok) return fail(502, 'server')
  return new Response(await image.arrayBuffer(), {
    headers: { 'content-type': 'image/webp', 'cache-control': 'private, max-age=86400' },
  })
})
