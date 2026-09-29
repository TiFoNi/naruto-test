import { gameMeta } from '@/src/games/meta.server'
import { SITE } from '@/src/brand'
import { cardUrl } from '@/src/pics'
import { type Lang } from '@/src/i18n/ui'
import { OG_SIZE, asPng, ogCard } from '@/src/og'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'NandaGuessr'

type Params = { params: Promise<{ lang: string; game: string; mode: string }> }

export default async function Image({ params }: Params) {
  const { lang, game: id } = await params
  const at = (['ru', 'uk', 'en'] as const).includes(lang as Lang) ? (lang as Lang) : 'en'
  const game = (await gameMeta()).find((one) => one.id === id)
  if (!game) return ogCard({ eyebrow: 'NandaGuessr', title: 'Guess the character' })

  const sources = game.featured.slice(0, 3).map(({ id: face, image }) => {
    const url = cardUrl(game.id, face, image)
    return url.startsWith('http') ? url : `${SITE}${url}`
  })
  const faces = (await Promise.all(sources.map(asPng))).filter((one): one is string => !!one)

  return ogCard({ title: game.label[at], accent: game.accent, faces })
}
