import { gameMeta } from '@/src/games/meta.server'
import ui, { type Lang } from '@/src/i18n/ui'
import { OG_SIZE, ogCard } from '@/src/og'

export const size = OG_SIZE
export const contentType = 'image/png'
export const alt = 'NandaGuessr'

type Params = { params: Promise<{ lang: string; game: string; mode: string }> }

export default async function Image({ params }: Params) {
  const { lang, game: id, mode } = await params
  const at = (['ru', 'uk', 'en'] as const).includes(lang as Lang) ? (lang as Lang) : 'en'
  const game = (await gameMeta()).find((one) => one.id === id)
  const modeKey = `mode.${mode}` as keyof typeof ui

  return ogCard({
    eyebrow: ui['daily.dashTitle'][at],
    title: game ? game.label[at] : 'NandaGuessr',
    note: ui['daily.ogNote'][at],
    tags: [ui[modeKey] ? ui[modeKey][at] : mode],
    accent: game?.accent,
  })
}
