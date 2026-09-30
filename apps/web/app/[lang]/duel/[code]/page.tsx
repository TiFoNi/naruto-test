import type { Metadata } from 'next'
import { findDuel } from '@nanda/core/duels'
import DuelRoom from '@/src/DuelRoom'
import { SITE } from '@/src/brand'
import { GAMES } from '@/src/games'
import { MODES } from '@/src/modes'
import ui, { type Lang } from '@/src/i18n/ui'

type Params = { params: Promise<{ lang: string; code: string }> }

const isCode = (code: string) => /^[A-Z0-9]{6}$/.test(code)

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, code } = await params
  const at = (lang as Lang) in ui['duel.title'] ? (lang as Lang) : 'en'
  const doc = isCode(code.toUpperCase()) ? await findDuel(code.toUpperCase()).catch(() => null) : null

  const game = GAMES.find((one) => one.id === doc?.game)
  const mode = MODES.find((one) => one.id === doc?.mode)
  const title = ui['duel.ogTitle'][at]
  const description = [game ? game.label[at] : '', mode ? ui[mode.label][at] : '', ui['duel.ogHint'][at]].filter(Boolean).join(' · ')

  return {
    title,
    description,
    openGraph: { title, description, url: `${SITE}/${at}/duel/${code.toUpperCase()}`, type: 'website' },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function DuelPage({ params }: Params) {
  const { code } = await params
  return <DuelRoom code={code.toUpperCase()} />
}
