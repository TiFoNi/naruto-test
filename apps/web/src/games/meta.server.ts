import { GAMES } from './index'
import type { GameMeta } from './meta'

const featuredIds = (game: (typeof GAMES)[number]) =>
  game.featured
    .map((name) => game.entities.find((e) => e.nameEn === name || e.name === name))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .slice(0, 3)
    .map((e) => e.id)

export const gameMeta = (): GameMeta[] =>
  GAMES.map((game) => ({
    id: game.id,
    label: game.label,
    description: game.description,
    category: game.category,
    accent: game.accent,
    modes: game.modes,
    unit: game.unit,
    count: game.entities.length,
    featured: featuredIds(game),
  }))
