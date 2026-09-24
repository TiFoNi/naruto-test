import { authSession } from './auth'

const allowed = () =>
  new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )

export async function adminSession(request: Request) {
  const session = await authSession(request)
  if (!session?.email) return null
  return allowed().has(session.email.toLowerCase()) ? session : null
}
