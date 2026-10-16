export type StarOrder = { orderId: string; stars: number; coins: number; packId: string }

const token = process.env.TELEGRAM_BOT_TOKEN ?? ''

const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? ''

const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`

export const starsReady = () => !!token

export const starsSecretOk = (headers: Headers) => !!secret && headers.get('x-telegram-bot-api-secret-token') === secret

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(api(method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string }
  if (!response.ok || !data.ok) throw new Error(data.description ?? `telegram_${method}_${response.status}`)
  return data.result as T
}

export async function starsLink({ orderId, stars, coins, packId }: StarOrder) {
  return call<string>('createInvoiceLink', {
    title: `NandaGuessr — ${coins} coins`,
    description: `${coins} coins for your NandaGuessr account (${packId})`,
    payload: orderId,
    currency: 'XTR',
    prices: [{ label: `${coins} coins`, amount: stars }],
  })
}

export const allowCheckout = (id: string) => call<boolean>('answerPreCheckoutQuery', { pre_checkout_query_id: id, ok: true })

export const denyCheckout = (id: string, why: string) => call<boolean>('answerPreCheckoutQuery', { pre_checkout_query_id: id, ok: false, error_message: why })

export const refundStars = (userId: number, chargeId: string) => call<boolean>('refundStarPayment', { user_id: userId, telegram_payment_charge_id: chargeId })

export type StarUpdate =
  | { kind: 'check'; id: string; payload: string }
  | { kind: 'paid'; payload: string; chargeId: string; stars: number; payer: number }
  | null

export function readUpdate(body: Record<string, unknown>): StarUpdate {
  const check = body.pre_checkout_query as { id?: string; invoice_payload?: string } | undefined
  if (check?.id && check.invoice_payload) return { kind: 'check', id: check.id, payload: check.invoice_payload }

  const message = body.message as { from?: { id?: number }; successful_payment?: Record<string, unknown> } | undefined
  const paid = message?.successful_payment
  if (!paid) return null

  const payload = typeof paid.invoice_payload === 'string' ? paid.invoice_payload : ''
  const chargeId = typeof paid.telegram_payment_charge_id === 'string' ? paid.telegram_payment_charge_id : ''
  if (!payload || !chargeId) return null

  return {
    kind: 'paid',
    payload,
    chargeId,
    stars: typeof paid.total_amount === 'number' ? paid.total_amount : 0,
    payer: message?.from?.id ?? 0,
  }
}
