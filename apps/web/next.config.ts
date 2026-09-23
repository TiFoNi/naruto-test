import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@nanda/game', '@nanda/core'],
  agentRules: false,
}

export default config
