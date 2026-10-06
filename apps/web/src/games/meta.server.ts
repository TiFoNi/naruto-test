import { GAMES } from './index'
import type { GameMeta } from './meta'

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') ?? ''
const FRESH = 600

type Row = { game: string; count: number; featured: { id: number; image?: string }[] }

export async function apiJson<T>(path: string, fresh = FRESH): Promise<T | null> {
  if (!API) return null
  try {
    const res = await fetch(`${API}/api/${path}`, { next: { revalidate: fresh } })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

export async function gameMeta(): Promise<GameMeta[]> {
  const data = await apiJson<{ games: Row[] }>('meta')
  const rows = new Map((data?.games ?? []).map((row) => [row.game, row]))

  return GAMES.map((game) => {
    const row = rows.get(game.id)
    return {
      id: game.id,
      label: game.label,
      description: game.description,
      category: game.category,
      accent: game.accent,
      modes: game.modes,
      unit: game.unit,
      count: row?.count ?? 0,
      featured: row?.featured ?? [],
    }
  })
}
