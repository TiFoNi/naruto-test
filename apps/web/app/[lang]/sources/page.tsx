import type { Metadata } from 'next'
import Sources from '@/src/Sources'
import ui, { LANGS, type Lang } from '@/src/i18n/ui'
import { alternates } from '@/src/seo'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  const safe = (LANGS.some((one) => one.id === lang) ? lang : 'ru') as Lang
  return {
    title: ui['sources.title'][safe],
    description: ui['sources.intro'][safe],
    alternates: alternates(`/${safe}/sources`),
  }
}

export default async function SourcesPage({ params }: Params) {
  const { lang } = await params
  const safe = (LANGS.some((one) => one.id === lang) ? lang : 'ru') as Lang
  return <Sources lang={safe} />
}
