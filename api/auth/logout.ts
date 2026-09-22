import { handle, json } from '../_lib/http.js'
import { clearedCookie } from '../_lib/session.js'

export const POST = handle(async (request) => json({ ok: true }, 200, clearedCookie(request)))
