import { fail, handle } from '../http'
import { roundOwner } from '../profile'
import { tuneClip } from '../tunes'

export const GET = handle(async (request) => {
  const owner = await roundOwner(request)
  const url = new URL(request.url)
  const key = url.searchParams.get('k') ?? ''
  const asked = Number(url.searchParams.get('t'))
  if (!key || !Number.isFinite(asked)) return fail(400, 'bad_request')

  const clip = await tuneClip(owner.id, key, asked)
  if (!clip) return fail(404, 'not_found')

  const pics = process.env.PICS_URL?.replace(/\/+$/, '') ?? url.origin
  const sound = await fetch(`${pics}/tunes/${clip.id}/${clip.seconds}.m4a`).catch(() => null)
  if (!sound?.ok) return fail(502, 'server')

  const bytes = Buffer.from(await sound.arrayBuffer())
  const base = {
    'content-type': 'audio/mp4',
    'cache-control': 'private, max-age=900',
    'accept-ranges': 'bytes',
  }

  const asking = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range')?.trim() ?? '')
  if (!asking) {
    return new Response(bytes, { headers: { ...base, 'content-length': String(bytes.length) } })
  }

  const last = bytes.length - 1
  const [, head, tail] = asking
  const from = head ? Number(head) : Math.max(0, bytes.length - Number(tail || 0))
  const to = head ? Math.min(tail ? Number(tail) : last, last) : last

  if (!head && !tail) return new Response(bytes, { headers: { ...base, 'content-length': String(bytes.length) } })
  if (from > to || from > last) {
    return new Response(null, { status: 416, headers: { ...base, 'content-range': `bytes */${bytes.length}` } })
  }

  const part = bytes.subarray(from, to + 1)
  return new Response(part, {
    status: 206,
    headers: { ...base, 'content-length': String(part.length), 'content-range': `bytes ${from}-${to}/${bytes.length}` },
  })
})
