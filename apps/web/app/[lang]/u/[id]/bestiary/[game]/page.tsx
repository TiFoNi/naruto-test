import Bestiary from '@/src/Bestiary'
import GameAccent from '@/src/GameAccent'
import '@/src/styles/dex.css'

type Params = { params: Promise<{ lang: string; id: string; game: string }> }

export default async function PlayerBestiaryPage({ params }: Params) {
  const { id, game } = await params
  return (
    <>
      <GameAccent game={game} />
      <Bestiary game={game} owner={id} />
    </>
  )
}
