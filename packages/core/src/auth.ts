import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { magicLink } from 'better-auth/plugins'
import { database } from './db'
import { magicLinkMail, sendMail } from './mail'

const MAGIC_LINK_TTL = 60 * 15

const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((origin) => origin.trim())

const hostOf = (origin: string) => {
  try {
    return new URL(origin).hostname
  } catch {
    return ''
  }
}

const passkeyHost = process.env.PASSKEY_RP_ID ?? hostOf(process.env.SITE_URL ?? origins[0]) ?? 'localhost'

const build = async () => {
  const db = await database()
  return betterAuth({
    appName: 'NandaGuessr',
    baseURL: process.env.AUTH_URL ?? origins[0],
    basePath: '/api/auth',
    secret: process.env.AUTH_SECRET,
    database: mongodbAdapter(db),
    trustedOrigins: origins,
    emailAndPassword: { enabled: false },
    account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        prompt: 'select_account',
      },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_TTL,
        sendMagicLink: async ({ email, url }) => {
          const { subject, html, text } = magicLinkMail(url)
          await sendMail(email, subject, html, text)
        },
      }),
      passkey({
        rpID: passkeyHost || 'localhost',
        rpName: 'NandaGuessr',
        origin: origins,
      }),
    ],
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    advanced: {
      cookiePrefix: 'nanda',
      ...(process.env.COOKIE_DOMAIN
        ? { crossSubDomainCookies: { enabled: true, domain: process.env.COOKIE_DOMAIN } }
        : {}),
    },
  })
}

let pending: ReturnType<typeof build> | null = null

export const auth = () => (pending ??= build())

type SessionUser = { id: string; email: string; name: string }

const SESSION_KEEP_MS = 60_000
const SESSION_KEEP_MAX = 5_000
const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?nanda\.session_token=([^;]+)/

const sessions = new Map<string, { at: number; user: SessionUser | null }>()

const tokenOf = (request: Request) => request.headers.get('cookie')?.match(SESSION_COOKIE)?.[1] ?? null

export async function authSession(request: Request) {
  const token = tokenOf(request)
  const kept = token ? sessions.get(token) : undefined
  if (kept && Date.now() - kept.at < SESSION_KEEP_MS) return kept.user
  const api = await auth()
  const found = await api.api.getSession({ headers: request.headers }).catch(() => null)
  const user = found?.user ? { id: found.user.id, email: found.user.email, name: found.user.name } : null
  if (token && found !== null) {
    if (sessions.size >= SESSION_KEEP_MAX) sessions.clear()
    sessions.set(token, { at: Date.now(), user })
  }
  return user
}

export async function authHandler(request: Request) {
  const token = tokenOf(request)
  if (token && request.method !== 'GET') sessions.delete(token)
  const api = await auth()
  return api.handler(request)
}
