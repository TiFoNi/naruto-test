import { client } from './_lib/db.js'
import { json } from './_lib/http.js'

export async function GET() {
  const uri = process.env.MONGODB_URI ?? ''
  const secret = process.env.AUTH_SECRET ?? ''
  const checks = {
    mongodbUri: uri ? (uri.includes('<') ? 'set, but contains a <placeholder>' : 'set') : 'missing',
    authSecret: secret ? (secret.length >= 32 ? 'set' : `too short (${secret.length} chars, need 32+)`) : 'missing',
    database: 'not checked',
  }
  if (uri) {
    try {
      await (await client()).db('admin').command({ ping: 1 })
      checks.database = 'ok'
    } catch (error) {
      const e = error as Error
      const hint = e.name === 'MongoServerSelectionError' ? ' — check Atlas IP Access List (0.0.0.0/0)' : ''
      checks.database = `error: ${e.name}: ${e.message.replace(/mongodb(\+srv)?:\/\/[^\s]+/g, '[uri]').slice(0, 160)}${hint}`
    }
  }
  const ok = checks.mongodbUri === 'set' && checks.authSecret === 'set' && checks.database === 'ok'
  return json({ ok, ...checks }, ok ? 200 : 500)
}
