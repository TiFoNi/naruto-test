import { applyPayment } from '../coins'
import { fail, handle, json } from '../http'
import { provider } from '../payments'

export const POST = handle(async (request) => {
  if (!provider.ready) return fail(503, 'payments_off')

  const raw = await request.text()
  if (!provider.verify(raw, request.headers)) return fail(401, 'bad_signature')

  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return fail(400, 'bad_request')
  }

  const event = provider.read(body)
  if (!event) return fail(400, 'bad_request')

  const done = await applyPayment(event)
  return json({ done })
})
