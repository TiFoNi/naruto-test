import ArenaGame from '@/src/ArenaGame'
import GameAccent from '@/src/GameAccent'
import '@/src/styles/dex.css'
import '@/src/styles/arena.css'

type Params = { params: Promise<{ lang: string; game: string }> }

export default async function ArenaPage({ params }: Params) {
  const { game } = await params
  return (
    <>
      <GameAccent game={game} />
      <ArenaGame game={game} />
    </>
  )
}
