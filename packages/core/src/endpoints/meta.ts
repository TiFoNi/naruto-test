import { GAME_IDS, GAME_SPECS } from '@nanda/game'
import { cached, handle } from '../http'
import { rounds } from '../db'
import { gameData } from '../games'
import { findChallenge, isCode } from '../challenges'
import { findDuel } from '../duels'
import { defaultNickname } from '../profile'

const FEATURED = 3
const DUEL_CODE = /^[A-Z0-9]{6}$/

export const GET = handle(async (request) => {
  const params = new URL(request.url).searchParams
  const duel = params.get('duel')
  const challenge = params.get('challenge')

  if (duel) {
    const doc = DUEL_CODE.test(duel) ? await findDuel(duel) : null
    return cached(doc ? { game: doc.game ?? null, mode: doc.mode ?? null } : {}, 60)
  }

  if (challenge) {
    const doc = isCode(challenge) ? await findChallenge(challenge) : null
    return cached(doc ? { game: doc.game, mode: doc.mode, author: defaultNickname(doc.author) } : {}, 60)
  }

  const played = new Map<string, number>(
    (
      await (await rounds())
        .aggregate<{ _id: string; plays: number }>([{ $match: { guest: { $ne: true } } }, { $group: { _id: '$game', plays: { $sum: 1 } } }])
        .toArray()
    ).map((row) => [row._id, row.plays]),
  )

  const games = await Promise.all(
    GAME_IDS.map(async (game) => {
      const { list, pool } = await gameData(game)
      const wanted = (GAME_SPECS[game].featured ?? [])
        .map((name) => list.find((entity) => entity.nameEn === name || entity.name === name))
        .filter((entity) => entity !== undefined)
      const featured = [...new Set([...wanted, ...pool])].slice(0, FEATURED)

      return {
        game,
        count: pool.length,
        plays: played.get(game) ?? 0,
        featured: featured.map((entity) => ({ id: entity.id as number, image: entity.image as string | undefined })),
      }
    }),
  )

  return cached({ games }, 300)
})
