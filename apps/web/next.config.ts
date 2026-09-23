import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@nanda/game', '@nanda/core'],
  allowedDevOrigins: ['192.168.0.38'],
  agentRules: false,
}

export default config
