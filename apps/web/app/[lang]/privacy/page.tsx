import type { Metadata } from 'next'
import Legal from '@/src/Legal'
import type { Lang } from '@/src/i18n/ui'
import { privacy } from '@/src/legal-text'
import { alternates } from '@/src/seo'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  const doc = privacy(lang as Lang)
  return { title: doc.title, description: doc.intro, alternates: alternates(`/${lang}/privacy`) }
}

export default async function PrivacyPage({ params }: Params) {
  const { lang } = await params
  return <Legal {...privacy(lang as Lang)} />
}
