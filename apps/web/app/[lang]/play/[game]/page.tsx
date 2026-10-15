import GameAccent from '@/src/GameAccent'
import WorldModes from '@/src/WorldModes'
import type { Lang } from '@/src/i18n/ui'
import { worldMetadata } from '@/src/seo'

export const revalidate = 600
export const generateStaticParams = async () => []

type Params = { params: Promise<{ lang: string; game: string }> }

export async function generateMetadata({ params }: Params) {
  const { lang, game } = await params
  return worldMetadata(lang as Lang, game)
}

export default async function WorldPage({ params }: Params) {
  const { game } = await params
  return (
    <>
      <GameAccent game={game} />
      <WorldModes game={game} />
    </>
  )
}
