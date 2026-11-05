import Bestiary from '@/src/Bestiary'
import GameAccent from '@/src/GameAccent'
import '@/src/styles/dex.css'

type Params = { params: Promise<{ lang: string; game: string }> }

export default async function BestiaryPage({ params }: Params) {
  const { game } = await params
  return (
    <>
      <GameAccent game={game} />
      <Bestiary game={game} />
    </>
  )
}
