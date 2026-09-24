import PlayView from '@/src/PlayView'
import type { Lang } from '@/src/i18n/ui'
import { playMetadata } from '@/src/seo'

type Params = { params: Promise<{ lang: string; game: string; mode: string }> }

export async function generateMetadata({ params }: Params) {
  const { lang, game, mode } = await params
  return playMetadata(lang as Lang, game, mode, true)
}

export default async function PlayPage({ params }: Params) {
  const { game, mode } = await params
  return <PlayView game={game} mode={mode} daily={true} />
}
