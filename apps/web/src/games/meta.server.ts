import { gameData } from '@nanda/core/games'
import { GAMES } from './index'
import type { GameMeta } from './meta'

export async function gameMeta(): Promise<GameMeta[]> {
  return Promise.all(
    GAMES.map(async (game) => {
      const { list, pool } = await gameData(game.id)
      const wanted = game.featured
        .map((name) => list.find((e) => e.nameEn === name || e.name === name))
        .filter((e): e is NonNullable<typeof e> => !!e)
      const featured = [...new Set([...wanted, ...pool])]
        .slice(0, 3)
        .map((e) => ({ id: e.id as number, image: e.image as string | undefined }))

      return {
        id: game.id,
        label: game.label,
        description: game.description,
        category: game.category,
        accent: game.accent,
        modes: game.modes,
        unit: game.unit,
        count: list.length,
        featured,
      }
    }),
  )
}
