import type { Metadata, Viewport } from 'next'
import { Manrope, Unbounded } from 'next/font/google'
import { notFound } from 'next/navigation'
import Providers from './providers'
import { SITE } from '@/src/brand'
import { LANGS, dictionary, type Lang } from '@/src/i18n/ui'
import { alternates, homeCopy } from '@/src/seo'
import { gameMeta } from '@/src/games/meta.server'
import { CATEGORIES } from '@/src/games/types'
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


export const revalidate = 600

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const copy = await homeCopy((LANGS.some((l) => l.id === lang) ? lang : 'ru') as Lang)

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

const API = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') ?? ''

const BOOT_SCRIPT = `try{var d=document.documentElement,c=localStorage.getItem('nanda.category');if(${JSON.stringify(CATEGORIES)}.indexOf(c)>=0)d.dataset.cat=c;if(localStorage.getItem('nanda.session')){d.dataset.auth='1';d.dataset.checking='1'}var p=location.pathname.split('/');var i=p.indexOf('duel');if(i>0&&p[i+1]&&sessionStorage.getItem('nanda.duel.'+p[i+1])==='play')d.dataset.duel='play';var j=p.indexOf('c');if(j>0&&p[j+1]&&sessionStorage.getItem('nanda.ch.'+p[j+1])==='result')d.dataset.ch='result'}catch(e){}
try{window.__me=fetch('${API}/api/me',{credentials:'${API ? 'include' : 'same-origin'}'}).then(function(r){return r.json().catch(function(){return{}}).then(function(data){return{ok:r.ok,status:r.status,data:data}})}).catch(function(){return null})}catch(e){}`

export const generateStaticParams = () => LANGS.map(({ id }) => ({ lang: id }))

export default async function RootLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params
  if (!LANGS.some((l) => l.id === lang)) notFound()

  return (
    <html lang={lang} className={`${manrope.variable} ${unbounded.variable}`} suppressHydrationWarning>
      <head>
        {API && <link rel="preconnect" href={API} crossOrigin="use-credentials" />}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers games={await gameMeta()} lang={lang as Lang} dict={dictionary(lang as Lang)}>
          {children}
        </Providers>
      </body>
    </html>
  )
}
