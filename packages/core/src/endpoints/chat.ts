import { users } from '../db'
import { fail, handle, json, readJson } from '../http'
import { currentUser, touchVisit, unauthorized } from '../profile'
import { adminSession } from '../admin'
import { CHAT_MAX, chatPage, dropChat, muteChat, sendChat } from '../chat'
import { chatOnline } from '../stream'

export const GET = handle(async (request) => {
  const url = new URL(request.url)
  const before = url.searchParams.get('before') ?? undefined
  const limit = Number(url.searchParams.get('limit')) || undefined
  const page = await chatPage(before, limit)
  return json({ ...page, max: CHAT_MAX, online: chatOnline() })
})

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const { text } = (await readJson(request)) as { text?: unknown }
  const line = await sendChat(found.doc, text)
  if (line === 'empty') return fail(400, 'bad_request')
  if (line === 'muted') return fail(403, 'muted')
  if (line === 'too_fast') return fail(429, 'too_fast')

  await touchVisit(await users(), found.doc._id!)
  return json({ line })
})

export const ADMIN = handle(async (request) => {
  if (!(await adminSession(request))) return fail(404, 'not_found')

  const { drop, mute, minutes } = (await readJson(request)) as { drop?: unknown; mute?: unknown; minutes?: unknown }
  if (drop !== undefined) return (await dropChat(drop)) ? json({ dropped: drop }) : fail(404, 'not_found')
  if (mute !== undefined) {
    const until = await muteChat(mute, minutes)
    return json({ muted: mute, until: until ? until.getTime() : null })
  }
  return fail(400, 'bad_request')
})
