import type { Metadata } from 'next'
import { findChallenge } from '@nanda/core/challenges'
import { gameData } from '@nanda/core/games'
import { defaultNickname } from '@nanda/core/profile'
import ChallengeRoom from '@/src/ChallengeRoom'
import { GAMES } from '@/src/games'
import { MODES } from '@/src/modes'
import { cardUrl } from '@/src/pics'
import ui from '@/src/i18n/ui'

type Params = { params: Promise<{ code: string }> }

const isCode = (code: string) => /^[A-Z0-9]{7}$/.test(code)

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params
  const doc = isCode(code.toUpperCase()) ? await findChallenge(code.toUpperCase()).catch(() => null) : null
  if (!doc) return { title: 'NandaGuessr' }

  const game = GAMES.find((g) => g.id === doc.game)
  const mode = MODES.find((m) => m.id === doc.mode)
  const title = ui['challenge.from'].ru.replace('{name}', defaultNickname(doc.author))
  const description = [game ? game.label.ru : '', mode ? ui[mode.label].ru : '', ui['challenge.ogHint'].ru].filter(Boolean).join(' · ')
  const list = game ? (await gameData(game.id)).list : []
  const featured = list.find((e) => e.nameEn === game!.featured[0] || e.name === game!.featured[0]) ?? list[0]

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: game && featured ? [{ url: cardUrl(game.id, featured.id, featured.image as string | undefined), width: 288, height: 384 }] : undefined,
    },
    twitter: { card: 'summary' },
  }
}

export default async function ChallengePage({ params }: Params) {
  const { code } = await params
  return <ChallengeRoom code={code.toUpperCase()} />
}
