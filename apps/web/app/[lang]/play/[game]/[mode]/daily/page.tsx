import GameAccent from '@/src/GameAccent'
import PlayView from '@/src/PlayView'
import type { Lang } from '@/src/i18n/ui'
import { playMetadata } from '@/src/seo'

export const revalidate = 600
export const generateStaticParams = async () => []

type Params = { params: Promise<{ lang: string; game: string; mode: string }> }

export async function generateMetadata({ params }: Params) {
  const { lang, game, mode } = await params
  return playMetadata(lang as Lang, game, mode, true)
}

export default async function PlayPage({ params }: Params) {
  const { game, mode } = await params
  return (
    <>
      <GameAccent game={game} />
      <PlayView game={game} mode={mode} daily={true} />
    </>
  )
}
