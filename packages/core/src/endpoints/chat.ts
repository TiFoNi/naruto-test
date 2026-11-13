import { users } from '../db'
import { fail, handle, json, readJson } from '../http'
import { currentUser, touchVisit, unauthorized } from '../profile'
import { adminSession } from '../admin'
import { authSession } from '../auth'
import { CHAT_MAX, NEWS_MAX, channelOf, chatPage, dropChat, dropOwnChat, joinBout, markSeen, muteChat, reactChat, sendBout, sendChat, sendNews, type BoutFail, type ReactFail } from '../chat'
import { markTyping } from '../stream'

const REACT_STATUS: Record<ReactFail, number> = { bad: 400, muted: 403, patron: 403, too_fast: 429, gone: 410 }

const BOUT_STATUS: Record<BoutFail, number> = { bad: 400, muted: 403, patron: 403, too_fast: 429, cooldown: 429, open: 409, own: 400, gone: 410, taken: 409 }

export const GET = handle(async (request) => {
  const url = new URL(request.url)
  const before = url.searchParams.get('before') ?? undefined
  const limit = Number(url.searchParams.get('limit')) || undefined
  const channel = channelOf(url.searchParams.get('channel'))
  const page = await chatPage(before, limit, channel)
  return json({ ...page, max: channel === 'news' ? NEWS_MAX : CHAT_MAX })
})

export const POST = handle(async (request) => {
  const url = new URL(request.url)
  if (url.searchParams.has('seen')) {
    const session = await authSession(request).catch(() => null)
    if (!session?.id) return unauthorized()
    const done = await markSeen(session.id, channelOf(url.searchParams.get('channel')), url.searchParams.get('seen'))
    return done ? json({ ok: true }) : fail(400, 'bad_request')
  }

  const found = await currentUser(request)
  if (!found) return unauthorized()

  const { text, channel, tags, reply, bout, join, react, kind, drop } = (await readJson(request)) as {
    drop?: unknown
    react?: unknown
    kind?: unknown
    text?: unknown
    channel?: unknown
    tags?: unknown
    reply?: unknown
    bout?: unknown
    join?: unknown
  }
  if (drop !== undefined) return (await dropOwnChat(found.doc, drop)) ? json({ dropped: drop }) : fail(404, 'not_found')
  if (react !== undefined) {
    const done = await reactChat(found.doc, react, kind ?? null)
    if (typeof done === 'string') return fail(REACT_STATUS[done], done === 'bad' ? 'bad_request' : done === 'patron' ? 'react_patron' : done)
    return json(done)
  }
  if (bout !== undefined || join !== undefined) {
    const line = bout !== undefined ? await sendBout(found.doc, bout) : await joinBout(found.doc, join)
    if (typeof line === 'string') return fail(BOUT_STATUS[line], line === 'bad' ? 'bad_request' : `bout_${line}`)
    await touchVisit(await users(), found.doc._id!)
    return json({ line })
  }
  if (channelOf(channel) === 'news') {
    if (!(await adminSession(request))) return fail(403, 'forbidden')
    const news = await sendNews(found.doc, text)
    return news === 'empty' ? fail(400, 'bad_request') : json({ line: news })
  }
  const line = await sendChat(found.doc, text, tags, reply, Boolean(await adminSession(request)))
  if (line === 'empty') return fail(400, 'bad_request')
  if (line === 'muted') return fail(403, 'muted')
  if (line === 'too_fast') return fail(429, 'too_fast')

  markTyping(found.doc._id!.toHexString(), found.doc.nickname ?? found.doc.username, false)
  await touchVisit(await users(), found.doc._id!)
  return json({ line })
})

export const TYPING = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const { on } = (await readJson(request)) as { on?: unknown }
  const muted = found.doc.chatMutedUntil && found.doc.chatMutedUntil.getTime() > Date.now()
  markTyping(found.doc._id!.toHexString(), found.doc.nickname ?? found.doc.username, on !== false && !muted)
  return json({ ok: true })
})

export const ADMIN = handle(async (request) => {
  if (!(await adminSession(request))) return fail(404, 'not_found')

  const { drop, mute, minutes, channel } = (await readJson(request)) as { drop?: unknown; mute?: unknown; minutes?: unknown; channel?: unknown }
  if (drop !== undefined) return (await dropChat(drop, channelOf(channel))) ? json({ dropped: drop }) : fail(404, 'not_found')
  if (mute !== undefined) {
    const until = await muteChat(mute, minutes)
    return json({ muted: mute, until: until ? until.getTime() : null })
  }
  return fail(400, 'bad_request')
})
