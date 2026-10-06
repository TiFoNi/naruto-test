import { GAMES } from '@/src/games'
import { MODES } from '@/src/modes'
import ui, { type Lang } from '@/src/i18n/ui'
import { OG_SIZE, ogBackground, ogCard } from '@/src/og'
import { apiJson } from '@/src/games/meta.server'

export const size = OG_SIZE
export const contentType = 'image/jpeg'
export const alt = 'NandaGuessr'

type Params = { params: Promise<{ lang: string; code: string }> }

export default async function Image({ params }: Params) {
  const { lang, code } = await params
  const at = (['ru', 'uk', 'en'] as const).includes(lang as Lang) ? (lang as Lang) : 'en'
  const doc = /^[A-Z0-9]{6}$/.test(code.toUpperCase()) ? await apiJson<{ game?: string; mode?: string }>(`meta?duel=${code.toUpperCase()}`, 60) : null
  const game = GAMES.find((one) => one.id === doc?.game)
  const mode = MODES.find((one) => one.id === doc?.mode)

  const background = game ? await ogBackground(game.id) : null

  return ogCard({
    eyebrow: ui['duel.title'][at],
    title: ui['duel.ogTitle'][at],
    note: ui['duel.ogHint'][at],
    tags: [code.toUpperCase(), game ? game.label[at] : '', mode ? ui[mode.label][at] : ''].filter(Boolean),
    accent: game?.accent,
    background,
  })
}
