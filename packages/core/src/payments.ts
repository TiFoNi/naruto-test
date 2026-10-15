import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'failed' | 'refunded'

export type PaymentEvent = { orderId: string; paymentId: string; status: PaymentStatus; payCurrency?: string; got?: number; need?: number }

export type InvoiceInput = { orderId: string; usd: number; coins: number; packId: string; coin: string }

export type Invoice = { url: string; invoiceId: string }

export type Provider = {
  id: string
  ready: boolean
  coins: string[]
  minUsd(coin: string): Promise<number | null>
  invoice(input: InvoiceInput): Promise<Invoice>
  verify(raw: string, headers: Headers): boolean
  read(body: Record<string, unknown>): PaymentEvent | null
}

const sorted = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sorted)
  if (!value || typeof value !== 'object') return value
  const source = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map((key) => [key, sorted(source[key])]),
  )
}

const sameDigest = (one: string, two: string) => {
  const left = Buffer.from(one, 'hex')
  const right = Buffer.from(two, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}

const PAID = new Set(['finished'])
const PARTIAL = new Set(['partially_paid'])
const FAILED = new Set(['failed', 'expired'])
const REFUNDED = new Set(['refunded'])

const number = (value: unknown) => (typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : undefined)

const text = (value: unknown) => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '')

function nowPayments(): Provider {
  const key = process.env.NOWPAYMENTS_API_KEY ?? ''
  const secret = process.env.NOWPAYMENTS_IPN_SECRET ?? ''
  const api = (process.env.NOWPAYMENTS_API ?? 'https://api.nowpayments.io/v1').replace(/\/+$/, '')
  const site = (process.env.SITE_URL ?? 'http://localhost:5173').replace(/\/+$/, '')
  const payout = (process.env.NOWPAYMENTS_PAYOUT ?? 'usdttrc20').trim()
  const callback = (process.env.PAYMENTS_CALLBACK_URL ?? `${(process.env.API_URL ?? site).replace(/\/+$/, '')}/api/shop/webhook`).trim()

  return {
    id: 'nowpayments',
    ready: !!key && !!secret,
    coins: ['trx', 'ltc', 'usdttrc20'],

    async minUsd(coin) {
      const response = await fetch(`${api}/min-amount?currency_from=${coin}&currency_to=${payout}&fiat_equivalent=usd`, { headers: { 'x-api-key': key } })
      if (!response.ok) return null
      const data = (await response.json().catch(() => ({}))) as { fiat_equivalent?: number }
      return typeof data.fiat_equivalent === 'number' ? data.fiat_equivalent : null
    },

    async invoice({ orderId, usd, coins, packId, coin }) {
      const response = await fetch(`${api}/invoice`, {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          price_amount: usd,
          price_currency: 'usd',
          pay_currency: coin,
          order_id: orderId,
          order_description: `NandaGuessr — ${coins} coins (${packId})`,
          ipn_callback_url: callback,
          success_url: `${site}/support?paid=${orderId}`,
          cancel_url: `${site}/support?cancelled=1`,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as { id?: string | number; invoice_url?: string; message?: string }
      if (!response.ok || !data.invoice_url) throw new Error(data.message ?? `invoice_failed_${response.status}`)
      return { url: data.invoice_url, invoiceId: text(data.id) }
    },

    verify(raw, headers) {
      const signature = headers.get('x-nowpayments-sig') ?? ''
      if (!signature || !secret) return false
      try {
        const digest = createHmac('sha512', secret).update(JSON.stringify(sorted(JSON.parse(raw)))).digest('hex')
        return sameDigest(digest, signature)
      } catch {
        return false
      }
    },

    read(body) {
      const orderId = text(body.order_id)
      const paymentId = text(body.payment_id)
      const state = text(body.payment_status).toLowerCase()
      if (!orderId || !state) return null

      const status: PaymentStatus = PAID.has(state)
        ? 'paid'
        : PARTIAL.has(state)
          ? 'partial'
          : REFUNDED.has(state)
            ? 'refunded'
            : FAILED.has(state)
              ? 'failed'
              : 'pending'

      return {
        orderId,
        paymentId,
        status,
        payCurrency: text(body.pay_currency) || undefined,
        got: number(body.actually_paid),
        need: number(body.pay_amount),
      }
    },
  }
}

const CRYPTOMUS_PAID = new Set(['paid', 'paid_over'])
const CRYPTOMUS_PARTIAL = new Set(['wrong_amount', 'wrong_amount_waiting'])
const CRYPTOMUS_FAILED = new Set(['fail', 'cancel', 'system_fail', 'locked'])
const CRYPTOMUS_REFUNDED = new Set(['refund_paid'])

function cryptomus(): Provider {
  const merchant = process.env.CRYPTOMUS_MERCHANT ?? ''
  const key = process.env.CRYPTOMUS_API_KEY ?? ''
  const api = (process.env.CRYPTOMUS_API ?? 'https://api.cryptomus.com/v1').replace(/\/+$/, '')
  const site = (process.env.SITE_URL ?? 'http://localhost:5173').replace(/\/+$/, '')
  const callback = (process.env.PAYMENTS_CALLBACK_URL ?? `${(process.env.API_URL ?? site).replace(/\/+$/, '')}/api/shop/webhook`).trim()

  const signed = (body: string) => createHash('md5').update(Buffer.from(body).toString('base64') + key).digest('hex')

  const escaped = (value: Record<string, unknown>) => JSON.stringify(value).replace(/\//g, '\\/')

  return {
    id: 'cryptomus',
    ready: !!merchant && !!key,
    coins: [],

    async minUsd() {
      return null
    },

    async invoice({ orderId, usd, coins, packId }) {
      const body = escaped({
        amount: usd.toFixed(2),
        currency: 'USD',
        order_id: orderId,
        lifetime: 3600,
        url_callback: callback,
        url_return: `${site}/support?cancelled=1`,
        url_success: `${site}/support?paid=${orderId}`,
        additional_data: `${coins} coins (${packId})`,
      })

      const response = await fetch(`${api}/payment`, {
        method: 'POST',
        headers: { merchant, sign: signed(body), 'content-type': 'application/json' },
        body,
      })

      const data = (await response.json().catch(() => ({}))) as { state?: number; result?: { uuid?: string; url?: string }; message?: string; errors?: unknown }
      const result = data.result
      if (!response.ok || data.state !== 0 || !result?.url) throw new Error(data.message ?? `invoice_failed_${response.status}`)
      return { url: result.url, invoiceId: text(result.uuid) }
    },

    verify(raw) {
      try {
        const { sign, ...rest } = JSON.parse(raw) as Record<string, unknown> & { sign?: string }
        if (typeof sign !== 'string' || !sign) return false
        const digest = signed(escaped(rest))
        return sign.length === digest.length && timingSafeEqual(Buffer.from(sign), Buffer.from(digest))
      } catch {
        return false
      }
    },

    read(body) {
      const orderId = text(body.order_id)
      const state = text(body.status).toLowerCase()
      if (!orderId || !state) return null

      const status: PaymentStatus = CRYPTOMUS_PAID.has(state)
        ? 'paid'
        : CRYPTOMUS_PARTIAL.has(state)
          ? 'partial'
          : CRYPTOMUS_REFUNDED.has(state)
            ? 'refunded'
            : CRYPTOMUS_FAILED.has(state)
              ? 'failed'
              : 'pending'

      return {
        orderId,
        paymentId: text(body.uuid),
        status,
        payCurrency: text(body.payer_currency) || undefined,
        got: number(body.payment_amount),
        need: number(body.amount),
      }
    },
  }
}

export async function floorUsd(): Promise<number | null> {
  const fresh = Date.now() - floor.at < 10 * 60 * 1000
  if (fresh) return floor.usd

  const all = await Promise.all(provider.coins.map((coin) => provider.minUsd(coin)))
  const known = all.filter((one): one is number => typeof one === 'number')
  floor.at = Date.now()
  floor.usd = known.length > 0 ? Math.min(...known) : null
  return floor.usd
}

const floor: { at: number; usd: number | null } = { at: 0, usd: null }

const pick = (): Provider => {
  const named = (process.env.PAYMENTS_PROVIDER ?? '').trim().toLowerCase()
  const all = [cryptomus(), nowPayments()]
  return all.find((one) => one.id === named) ?? all.find((one) => one.ready) ?? all[0]
}

export const provider = pick()
