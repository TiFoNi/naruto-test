import { betterAuth } from 'better-auth'
import { mongodbAdapter } from 'better-auth/adapters/mongodb'
import { magicLink } from 'better-auth/plugins'
import { database } from './db'
import { magicLinkMail, sendMail } from './mail'

const MAGIC_LINK_TTL = 60 * 15

const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((origin) => origin.trim())

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

export async function authSession(request: Request) {
  const api = await auth()
  const found = await api.api.getSession({ headers: request.headers }).catch(() => null)
  return found?.user ? { id: found.user.id, email: found.user.email, name: found.user.name } : null
}

export async function authHandler(request: Request) {
  const api = await auth()
  return api.handler(request)
}
