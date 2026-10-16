import { applyPayment } from '../coins'
import { fail, handle, json } from '../http'
import { allowCheckout, denyCheckout, readUpdate, starsReady, starsSecretOk } from '../telegram'
import { purchases } from '../db'

export const POST = handle(async (request) => {
  if (!starsReady()) return fail(503, 'payments_off')
  if (!starsSecretOk(request.headers)) return fail(401, 'bad_secret')

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const update = readUpdate(body)
  if (!update) return json({ ok: true })

  if (update.kind === 'check') {
    const order = await (await purchases()).findOne({ orderId: update.payload, status: 'pending' })
    if (order) await allowCheckout(update.id)
    else await denyCheckout(update.id, 'Order not found')
    return json({ ok: true })
  }

  const done = await applyPayment({ orderId: update.payload, paymentId: update.chargeId, status: 'paid', payCurrency: 'XTR' })
  return json({ done })
})
