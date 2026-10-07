import Dashboard from '@/src/Dashboard'
import { gameMeta } from '@/src/games/meta.server'
import HomeAbout from '@/src/HomeAbout'
import { homeSchema } from '@/src/seo'
import type { Lang } from '@/src/i18n/ui'
import '@/src/styles/home.css'

export const revalidate = 600

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params
  const [games, schema] = await Promise.all([gameMeta(), homeSchema(lang as Lang)])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <Dashboard games={games} />
      <HomeAbout lang={lang as Lang} games={games} />
    </>
  )
}
