import type { Metadata } from 'next'
import Support from '@/src/Support'
import ui, { LANGS, type Lang } from '@/src/i18n/ui'
import { alternates } from '@/src/seo'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  const safe = (LANGS.some((one) => one.id === lang) ? lang : 'ru') as Lang
  return { title: ui['support.title'][safe], description: ui['support.lead'][safe], alternates: alternates(`/${safe}/support`) }
}

export default function SupportPage() {
  return <Support />
}
