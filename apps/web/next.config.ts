import type { NextConfig } from 'next'

const upstream = (process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '')

const config: NextConfig = {
  transpilePackages: ['@nanda/game', '@nanda/core'],
  devIndicators: false,
  allowedDevOrigins: ['192.168.0.38'],
  agentRules: false,
  async rewrites() {
    return upstream ? [{ source: '/api/:path*', destination: `${upstream}/api/:path*` }] : []
  },
  async headers() {
    return [
      { source: '/terms.json', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=604800' }] },
      { source: '/frames/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=2592000' }] },
      {
        source: '/:dir(banners|worlds|awards|shop|promo|avatar)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ]
  },
}

export default config
