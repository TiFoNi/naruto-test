import { magicLinkClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '')

export const authClient = createAuthClient({
  ...(base ? { baseURL: base } : {}),
  basePath: '/api/auth',
  plugins: [magicLinkClient()],
})
