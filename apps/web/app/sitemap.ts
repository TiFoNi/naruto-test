import type { MetadataRoute } from 'next'
import { SITE } from '@/src/brand'
import { gameMeta } from '@/src/games/meta.server'
import { LANGS } from '@/src/i18n/ui'

const CODES = LANGS.map(({ id }) => id)

const languages = (path: string) => ({
  languages: {
    ...Object.fromEntries(CODES.map((code) => [code, `${SITE}/${code}${path}`])),
    'x-default': `${SITE}${path || '/'}`,
  },
})

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date()
  const games = await gameMeta()
  const paths = [
    { path: '', changeFrequency: 'daily' as const, priority: 1 },
    ...games.map((game) => ({ path: `/play/${game.id}`, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...games.flatMap((game) =>
      game.modes.map((mode) => ({ path: `/play/${game.id}/${mode}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ),
  ]

  return paths.flatMap(({ path, changeFrequency, priority }) =>
    CODES.map((code) => ({
      url: `${SITE}/${code}${path}`,
      lastModified,
      changeFrequency,
      priority,
      alternates: languages(path),
    })),
  )
}
