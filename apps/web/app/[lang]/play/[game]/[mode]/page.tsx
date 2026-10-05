import GameAccent from '@/src/GameAccent'
import PlayView from '@/src/PlayView'
import type { Lang } from '@/src/i18n/ui'
import { playMetadata, playSchema } from '@/src/seo'

type Params = { params: Promise<{ lang: string; game: string; mode: string }> }

export async function generateMetadata({ params }: Params) {
  const { lang, game, mode } = await params
  return playMetadata(lang as Lang, game, mode, false)
}

export default async function PlayPage({ params }: Params) {
  const { lang, game, mode } = await params
  const schema = await playSchema(lang as Lang, game, mode)
  return (
    <>
      {schema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />}
      <GameAccent game={game} />
      <PlayView game={game} mode={mode} daily={false} />
    </>
  )
}
