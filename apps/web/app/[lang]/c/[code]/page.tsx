import type { Metadata } from 'next'
import { findChallenge } from '@nanda/core/challenges'
import { defaultNickname } from '@nanda/core/profile'
import { SITE } from '@/src/brand'
import ChallengeRoom from '@/src/ChallengeRoom'
import { GAMES } from '@/src/games'
import { MODES } from '@/src/modes'
import ui, { type Lang } from '@/src/i18n/ui'

type Params = { params: Promise<{ lang: string; code: string }> }

const isCode = (code: string) => /^[A-Z0-9]{7}$/.test(code)

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang, code } = await params
  const at = (['ru', 'uk', 'en'] as const).includes(lang as Lang) ? (lang as Lang) : 'en'
  const doc = isCode(code.toUpperCase()) ? await findChallenge(code.toUpperCase()).catch(() => null) : null
  if (!doc) return { title: 'NandaGuessr' }

  const game = GAMES.find((g) => g.id === doc.game)
  const mode = MODES.find((m) => m.id === doc.mode)
  const title = ui['challenge.from'][at].replace('{name}', defaultNickname(doc.author))
  const description = [game ? game.label[at] : '', mode ? ui[mode.label][at] : '', ui['challenge.ogHint'][at]].filter(Boolean).join(' · ')

  return {
    title,
    description,
    openGraph: { title, description, url: `${SITE}/${at}/c/${code.toUpperCase()}`, type: 'website' },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function ChallengePage({ params }: Params) {
  const { code } = await params
  return <ChallengeRoom code={code.toUpperCase()} />
}
