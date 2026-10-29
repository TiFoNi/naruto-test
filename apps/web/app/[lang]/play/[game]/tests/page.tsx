import { notFound, redirect } from 'next/navigation'
import { GAMES } from '@/src/games'

type Params = { params: Promise<{ lang: string; game: string }> }

export default async function TestsPage({ params }: Params) {
  const { lang, game } = await params
  const world = GAMES.find((one) => one.id === game)
  if (!world) notFound()
  redirect(`/${lang}/tests/${world.category}`)
}
