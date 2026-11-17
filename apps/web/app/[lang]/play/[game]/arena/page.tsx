import ArenaGame from '@/src/ArenaGame'
import GameAccent from '@/src/GameAccent'
import '@/src/styles/dex.css'
import '@/src/styles/arena.css'

type Params = { params: Promise<{ lang: string; game: string }>; searchParams: Promise<{ fx?: string }> }

export default async function ArenaPage({ params, searchParams }: Params) {
  const { game } = await params
  const fx = (await searchParams).fx
  const demo = process.env.NODE_ENV !== 'production' && fx !== undefined ? (fx === 'shop' ? 'shop' : 'fight') : false
  return (
    <>
      <GameAccent game={game} />
      <ArenaGame game={game} demo={demo} />
    </>
  )
}
