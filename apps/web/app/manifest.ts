import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NandaGuessr — угадай персонажа аниме и игр',
    short_name: 'NandaGuessr',
    description: 'Угадывай персонажей по признакам, картинкам и способностям.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0d0f12',
    theme_color: '#0d0f12',
    related_applications: [{ platform: 'webapp', url: 'https://nandaguessr.com/manifest.webmanifest' }],
    prefer_related_applications: false,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
