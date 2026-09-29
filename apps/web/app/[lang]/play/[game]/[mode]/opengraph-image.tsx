import { gameMeta } from '@/src/games/meta.server'
import ui, { type Lang } from '@/src/i18n/ui'
import { OG_SIZE, ogCard } from '@/src/og'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'NandaGuessr'

type Params = { params: Promise<{ lang: string; game: string; mode: string }> }

const UNITS = {
  ru: { manga: 'тайтлов', hero: 'героев', character: 'персонажей', player: 'футболистов' },
  uk: { manga: 'тайтлів', hero: 'героїв', character: 'персонажів', player: 'футболістів' },
  en: { manga: 'titles', hero: 'heroes', character: 'characters', player: 'players' },
} as const

export default async function Image({ params }: Params) {
  const { lang, game: id, mode } = await params
  const at = (['ru', 'uk', 'en'] as const).includes(lang as Lang) ? (lang as Lang) : 'en'
  const game = (await gameMeta()).find((one) => one.id === id)
  if (!game) return ogCard({ eyebrow: 'NandaGuessr', title: 'Guess the character' })

  const modeKey = `mode.${mode}` as keyof typeof ui
  return ogCard({
    eyebrow: ui[modeKey] ? ui[modeKey][at] : mode,
    title: game.label[at],
    note: `${game.count} ${UNITS[at][game.unit]}`,
    tags: [ui['daily.dashTitle'][at], ui['duel.title'][at]],
    accent: game.accent,
  })
}
