import type { Metadata, Viewport } from 'next'
import { Manrope, Unbounded } from 'next/font/google'
import Providers from './providers'
import { SITE } from '@/src/brand'
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'NandaGuessr — угадай персонажа аниме и игр',
    template: '%s · NandaGuessr',
  },
  description:
    'Угадывай персонажей по признакам и картинкам: Наруто, Ван Пис, Атака титанов, Блич, Тетрадь смерти, Dota 2 и ещё десяток вселенных. Подсказки после каждой попытки, персонаж дня и дуэли с друзьями — без лимитов.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'NandaGuessr',
    url: SITE,
    title: 'NandaGuessr — угадай персонажа аниме и игр',
    description: 'Наруто, Ван Пис, Атака титанов, Блич, Dota 2 и ещё десяток вселенных. Подсказки после каждой попытки, без лимитов на день.',
  },
  twitter: { card: 'summary_large_image' },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='6' y='6' width='52' height='52' rx='16' fill='%23ff8a1f' transform='rotate(-6 32 32)'/><text x='32' y='45' font-family='Arial Black,Arial' font-weight='900' font-size='30' text-anchor='middle' fill='%230d0f12'>?!</text></svg>",
  },
}

export const viewport: Viewport = { themeColor: '#0d0f12' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${manrope.variable} ${unbounded.variable}`}>
      <body>
        <Providers games={gameMeta()}>{children}</Providers>
      </body>
    </html>
  )
}
