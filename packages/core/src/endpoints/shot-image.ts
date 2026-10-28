import { fail, handle } from '../http'
import { roundOwner } from '../profile'
import { shotShown } from '../shots'

export const GET = handle(async (request) => {
  const owner = await roundOwner(request)
  const params = new URL(request.url).searchParams
  const asked = Number(params.get('l'))
  const day = params.get('d') ?? undefined
  const shown = await shotShown(owner.id, Number.isFinite(asked) ? asked : undefined, day)
  if (!shown) return fail(404, 'not_found')

  const pics = process.env.PICS_URL?.replace(/\/+$/, '') ?? new URL(request.url).origin
  const tag = shown.ver ? `?v=${shown.ver}` : ''
  const image = await fetch(`${pics}/shots/frames/${shown.answerId}/${shown.level}/${shown.name}.webp${tag}`).catch(() => null)
  if (!image?.ok) return fail(502, 'server')

  return new Response(Buffer.from(await image.arrayBuffer()), {
    headers: { 'content-type': 'image/webp', 'cache-control': 'private, max-age=900' },
  })
})
