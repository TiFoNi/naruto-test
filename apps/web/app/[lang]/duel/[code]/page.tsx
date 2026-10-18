import type { Metadata } from 'next'
import DuelRoom from '@/src/DuelRoom'
import { SITE } from '@/src/brand'
import { GAMES } from '@/src/games'
import { MODES } from '@/src/modes'
import ui, { type Lang } from '@/src/i18n/ui'
import { apiJson } from '@/src/games/meta.server'
import { OG_SIZE } from '@/src/og'

type Params = { params: Promise<{ lang: string; code: string }> }

export const revalidate = 0

const isCode = (code: string) => /^[A-Z0-9]{6}$/.test(code)

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, code } = await params
  const at = (lang as Lang) in ui['duel.title'] ? (lang as Lang) : 'en'
  const doc = isCode(code.toUpperCase()) ? await apiJson<{ game?: string; mode?: string }>(`meta?duel=${code.toUpperCase()}`, 0) : null

  const game = GAMES.find((one) => one.id === doc?.game)
  const mode = MODES.find((one) => one.id === doc?.mode)
  const title = ui['duel.ogTitle'][at]
  const description = [game ? game.label[at] : '', mode ? ui[mode.label][at] : '', ui['duel.ogHint'][at]].filter(Boolean).join(' · ')

  const room = code.toUpperCase()
  const stamp = [doc?.game, doc?.mode].filter(Boolean).join('-') || 'new'
  const picture = { url: `${SITE}/${at}/duel/${room}/opengraph-image?v=${stamp}`, ...OG_SIZE }

  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `${SITE}/${at}/duel/${room}` },
    openGraph: { title, description, url: `${SITE}/${at}/duel/${room}`, type: 'website', images: [picture] },
    twitter: { card: 'summary_large_image', images: [picture] },
  }
}

export default async function DuelPage({ params }: Params) {
  const { code } = await params
  return <DuelRoom code={code.toUpperCase()} />
}
