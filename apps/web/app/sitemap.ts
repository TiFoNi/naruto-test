import type { MetadataRoute } from 'next'
import { SITE } from '@/src/brand'
import { gameMeta } from '@/src/games/meta.server'
import { LANGS } from '@/src/i18n/ui'

const CODES = LANGS.map(({ id }) => id)

const languages = (path: string) => ({
  languages: {
    ...Object.fromEntries(CODES.map((code) => [code, `${SITE}/${code}${path}`])),
    'x-default': `${SITE}/ru${path}`,
  },
})

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const paths = [
    { path: '', changeFrequency: 'daily' as const, priority: 1 },
    ...gameMeta().flatMap((game) =>
      game.modes.map((mode) => ({ path: `/play/${game.id}/${mode}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ),
    { path: '/privacy', changeFrequency: 'yearly' as const, priority: 0.2 },
    { path: '/terms', changeFrequency: 'yearly' as const, priority: 0.2 },
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
