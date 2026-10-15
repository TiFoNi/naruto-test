import type { Metadata } from 'next'
import Legal from '@/src/Legal'
import type { Lang } from '@/src/i18n/ui'
import { refunds } from '@/src/legal-text'
import { alternates } from '@/src/seo'

type Params = { params: Promise<{ lang: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { lang } = await params
  const doc = refunds(lang as Lang)
  return { title: doc.title, description: doc.intro, alternates: alternates(`/${lang}/refunds`), robots: { index: false, follow: false } }
}

export default async function RefundsPage({ params }: Params) {
  const { lang } = await params
  return <Legal {...refunds(lang as Lang)} />
}
