import type { MetadataRoute } from 'next'
import { SITE } from '@/src/brand'
import { gameMeta } from '@/src/games/meta.server'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const games = gameMeta().flatMap((game) =>
    game.modes.map((mode) => ({
      url: `${SITE}/play/${game.id}/${mode}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  )
  return [
    { url: SITE, lastModified, changeFrequency: 'daily' as const, priority: 1 },
    ...games,
    { url: `${SITE}/privacy`, lastModified, changeFrequency: 'yearly' as const, priority: 0.2 },
    { url: `${SITE}/terms`, lastModified, changeFrequency: 'yearly' as const, priority: 0.2 },
  ]
}
