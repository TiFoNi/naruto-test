import PlayView from '@/src/PlayView'
import { playMetadata } from '@/src/seo'

type Params = { params: Promise<{ game: string; mode: string }> }

export async function generateMetadata({ params }: Params) {
  const { game, mode } = await params
  return playMetadata(game, mode, true)
}

export default async function PlayPage({ params }: Params) {
  const { game, mode } = await params
  return <PlayView game={game} mode={mode} daily={true} />
}
