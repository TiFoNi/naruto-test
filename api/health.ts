import { client } from './_lib/db.js'
import { json } from './_lib/http.js'

export async function GET() {
  const uri = process.env.MONGODB_URI ?? ''
  const secret = process.env.AUTH_SECRET ?? ''
  const checks = {
    mongodbUri: uri ? (uri.includes('<') ? 'set, but contains a <placeholder>' : 'set') : 'missing',
    authSecret: secret ? (secret.length >= 32 ? 'set' : 'too short (need 32+ chars)') : 'missing',
    database: 'not checked',
  }
  if (uri) {
    try {
      await (await client()).db('admin').command({ ping: 1 })
      checks.database = 'ok'
    } catch (error) {
      const e = error as Error
      const hints: Record<string, string> = {
        MongoServerSelectionError: 'cannot reach the cluster — check Atlas IP Access List (0.0.0.0/0)',
        MongoServerError: /auth/i.test(e.message) ? 'authentication failed — check user/password in MONGODB_URI' : 'server error',
        MongoParseError: 'MONGODB_URI is malformed',
      }
      checks.database = `error: ${hints[e.name] ?? e.name}`
    }
  }
  const ok = checks.mongodbUri === 'set' && checks.authSecret === 'set' && checks.database === 'ok'
  return json({ ok, ...checks }, ok ? 200 : 500)
}
