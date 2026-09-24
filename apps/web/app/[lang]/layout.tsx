import type { Metadata, Viewport } from 'next'
import { Manrope, Unbounded } from 'next/font/google'
import { notFound } from 'next/navigation'
import Providers from './providers'
import { SITE } from '@/src/brand'
import { LANGS, type Lang } from '@/src/i18n/ui'
import { HOME, alternates } from '@/src/seo'
import { gameMeta } from '@/src/games/meta.server'
import '@/src/styles.css'

const manrope = Manrope({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
})

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const copy = HOME[(LANGS.some((l) => l.id === lang) ? lang : 'ru') as Lang]

  return {
    metadataBase: new URL(SITE),
    title: { default: copy.title, template: '%s · NandaGuessr' },
    description: copy.description,
    alternates: alternates(`/${lang}`),
    openGraph: { type: 'website', siteName: 'NandaGuessr', url: `${SITE}/${lang}`, title: copy.title, description: copy.description },
    twitter: { card: 'summary_large_image' },
    icons: {
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='6' y='6' width='52' height='52' rx='16' fill='%23ff8a1f' transform='rotate(-6 32 32)'/><text x='32' y='45' font-family='Arial Black,Arial' font-weight='900' font-size='30' text-anchor='middle' fill='%230d0f12'>?!</text></svg>",
    },
  }
}

export const viewport: Viewport = { themeColor: '#0d0f12' }

export const generateStaticParams = () => LANGS.map(({ id }) => ({ lang: id }))

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!LANGS.some((l) => l.id === lang)) notFound()

  return (
    <html lang={lang} className={`${manrope.variable} ${unbounded.variable}`}>
      <body>
        <Providers games={await gameMeta()} lang={lang as Lang}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
