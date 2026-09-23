import type { Metadata, Viewport } from 'next'
import Providers from './providers'
import '@/src/styles.css'

export const metadata: Metadata = {
  title: 'NandaGuessr',
  description:
    'NandaGuessr — guess anime and game characters by traits and pictures, no daily limits: Naruto, Attack on Titan, Bleach, Tokyo Ghoul, Berserk, Dota 2.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect x='6' y='6' width='52' height='52' rx='16' fill='%23ff8a1f' transform='rotate(-6 32 32)'/><text x='32' y='45' font-family='Arial Black,Arial' font-weight='900' font-size='30' text-anchor='middle' fill='%230d0f12'>?!</text></svg>",
  },
}

export const viewport: Viewport = { themeColor: '#0d0f12' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Unbounded:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
