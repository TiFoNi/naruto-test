import { cached, fail, handle } from '../http'
import { gameData, isGame } from '../games'

export const GET = handle(async (request) => {
  const game = new URL(request.url).searchParams.get('game')
  if (!isGame(game)) return fail(400, 'bad_request')

  const { list, updated } = await gameData(game)
  return cached({ entities: list, updated }, 300)
})
