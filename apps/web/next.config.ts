import type { NextConfig } from 'next'

const upstream = (process.env.API_ORIGIN ?? process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '')

const config: NextConfig = {
  transpilePackages: ['@nanda/game', '@nanda/core'],
  allowedDevOrigins: ['192.168.0.38'],
  agentRules: false,
  async rewrites() {
    return upstream ? [{ source: '/api/:path*', destination: `${upstream}/api/:path*` }] : []
  },
  async headers() {
    return [{ source: '/terms.json', headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=604800' }] }]
  },
}

export default config
