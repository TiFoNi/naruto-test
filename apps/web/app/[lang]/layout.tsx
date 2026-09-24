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
  preload: false,
})

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const copy = HOME[(LANGS.some((l) => l.id === lang) ? lang : 'ru') as Lang]

  return {
    metadataBase: new URL(SITE),
    title: { default: copy.title, template: '%s · NandaGuessr' },
    description: copy.description,
    alternates: alternates(`/${lang}`),
    openGraph: {
      type: 'website',
      siteName: 'NandaGuessr',
      url: `${SITE}/${lang}`,
      title: copy.title,
      description: copy.description,
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: copy.title }],
    },
    twitter: { card: 'summary_large_image', title: copy.title, description: copy.description, images: ['/opengraph-image.png'] },
  }
}

export const viewport: Viewport = { themeColor: '#0d0f12' }

const CATEGORY_SCRIPT = `try{var d=document.documentElement,c=localStorage.getItem('nanda.category');if(c==='anime'||c==='manga'||c==='games')d.dataset.cat=c;if(localStorage.getItem('nanda.session'))d.dataset.auth='1'}catch(e){}`

export const generateStaticParams = () => LANGS.map(({ id }) => ({ lang: id }))

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!LANGS.some((l) => l.id === lang)) notFound()

  return (
    <html lang={lang} className={`${manrope.variable} ${unbounded.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: CATEGORY_SCRIPT }} />
      </head>
      <body>
        <Providers games={await gameMeta()} lang={lang as Lang}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
