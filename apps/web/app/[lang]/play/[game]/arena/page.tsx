import ArenaGame from '@/src/ArenaGame'
import GameAccent from '@/src/GameAccent'
import '@/src/styles/dex.css'
import '@/src/styles/arena.css'

type Params = { params: Promise<{ lang: string; game: string }>; searchParams: Promise<{ fx?: string }> }

export default async function ArenaPage({ params, searchParams }: Params) {
  const { game } = await params
  const demo = process.env.NODE_ENV !== 'production' && (await searchParams).fx !== undefined
  return (
    <>
      <GameAccent game={game} />
      <ArenaGame game={game} demo={demo} />
    </>
  )
}
