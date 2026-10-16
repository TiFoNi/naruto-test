import { randomUUID } from 'node:crypto'
import type { ObjectId } from 'mongodb'
import { coinOf, coinsOf, packOf, wayOf } from '@nanda/game'
import { coinLedger, purchases, users } from './db'
import { provider, type PaymentEvent } from './payments'
import { starsLink, starsReady } from './telegram'

const FEE_FLAT = Number(process.env.PAYMENTS_FEE_USD ?? 3.6)
const FEE_PCT = Number(process.env.PAYMENTS_FEE_PCT ?? 1)

export const chargeUsd = (usd: number) => Math.ceil(((usd + FEE_FLAT) / (1 - FEE_PCT / 100)) * 100) / 100

export const feeUsd = (usd: number) => Math.round((chargeUsd(usd) - usd) * 100) / 100

export type Started = { url: string; orderId: string }

export type TooSmall = { tooSmall: number }

export async function startPurchase(userId: ObjectId, packId: unknown, coinId: unknown, wayId: unknown = 'crypto'): Promise<Started | TooSmall | 'bad_pack' | 'off'> {
  const pack = packOf(packId)
  const way = wayOf(wayId)
  if (!pack || !way) return 'bad_pack'

  const orderId = `ng_${randomUUID().replace(/-/g, '').slice(0, 20)}`
  const book = await purchases()
  const coins = coinsOf(pack)

  if (way === 'stars') {
    if (!starsReady()) return 'off'

    await book.insertOne({
      userId,
      packId: pack.id,
      base: pack.base,
      bonus: pack.bonus,
      usd: pack.usd,
      stars: pack.stars,
      way,
      provider: 'telegram',
      orderId,
      status: 'pending',
      createdAt: new Date(),
    })

    try {
      const url = await starsLink({ orderId, stars: pack.stars, coins, packId: pack.id })
      await book.updateOne({ orderId }, { $set: { updatedAt: new Date() } })
      return { url, orderId }
    } catch (error) {
      await book.updateOne({ orderId, status: 'pending' }, { $set: { status: 'failed', updatedAt: new Date() } })
      throw error
    }
  }

  const asks = provider.coins.length > 0
  const coin = asks ? coinOf(coinId) : null
  if (asks && (!coin || !provider.coins.includes(coin.id))) return 'bad_pack'
  if (!provider.ready) return 'off'

  const least = coin ? await provider.minUsd(coin.id) : null
  if (least !== null && chargeUsd(pack.usd) < least) return { tooSmall: Math.ceil(least * 100) / 100 }

  const charge = chargeUsd(pack.usd)
  await book.insertOne({
    userId,
    packId: pack.id,
    base: pack.base,
    bonus: pack.bonus,
    usd: pack.usd,
    charged: charge,
    way,
    provider: provider.id,
    orderId,
    ...(coin ? { payCurrency: coin.id } : {}),
    status: 'pending',
    createdAt: new Date(),
  })

  try {
    const invoice = await provider.invoice({ orderId, usd: charge, coins, packId: pack.id, coin: coin?.id ?? '' })
    await book.updateOne({ orderId }, { $set: { invoiceId: invoice.invoiceId, updatedAt: new Date() } })
    return { url: invoice.url, orderId }
  } catch (error) {
    await book.updateOne({ orderId, status: 'pending' }, { $set: { status: 'failed', updatedAt: new Date() } })
    throw error
  }
}

async function credit(purchaseId: ObjectId, userId: ObjectId, delta: number, reason: 'purchase' | 'refund') {
  try {
    await (await coinLedger()).insertOne({ userId, delta, reason, purchaseId, at: new Date() })
  } catch {
    return false
  }

  const people = await users()
  await people.updateOne({ _id: userId }, { $inc: { coins: delta } })
  if (delta < 0) await people.updateOne({ _id: userId, coins: { $lt: 0 } }, { $set: { coins: 0 } })
  return true
}

export async function applyPayment(event: PaymentEvent) {
  const book = await purchases()
  const stamp = {
    paymentId: event.paymentId,
    payCurrency: event.payCurrency,
    ...(typeof event.got === 'number' ? { got: event.got } : {}),
    ...(typeof event.need === 'number' ? { need: event.need } : {}),
    updatedAt: new Date(),
  }

  if (event.status === 'paid') {
    const paid = await book.findOneAndUpdate(
      { orderId: event.orderId, status: 'pending' },
      { $set: { ...stamp, status: 'paid' } },
      { returnDocument: 'after' },
    )
    if (!paid) return 'skipped'
    await credit(paid._id!, paid.userId, paid.base + paid.bonus, 'purchase')
    return 'paid'
  }

  if (event.status === 'refunded') {
    const back = await book.findOneAndUpdate(
      { orderId: event.orderId, status: 'paid' },
      { $set: { ...stamp, status: 'refunded' } },
      { returnDocument: 'after' },
    )
    if (!back) return 'skipped'
    await credit(back._id!, back.userId, -(back.base + back.bonus), 'refund')
    return 'refunded'
  }

  if (event.status === 'partial') {
    await book.updateOne({ orderId: event.orderId, status: 'pending' }, { $set: { ...stamp, status: 'partial' } })
    return 'partial'
  }

  if (event.status === 'failed') {
    await book.updateOne({ orderId: event.orderId, status: 'pending' }, { $set: { ...stamp, status: 'failed' } })
    return 'failed'
  }

  await book.updateOne({ orderId: event.orderId, status: 'pending' }, { $set: stamp })
  return 'pending'
}

export async function purchaseState(userId: ObjectId, orderId: string) {
  const found = await (await purchases()).findOne({ orderId, userId })
  if (!found) return null

  return {
    status: found.status,
    coins: found.base + found.bonus,
    ...(found.status === 'partial' ? { got: found.got, need: found.need, coin: found.payCurrency } : {}),
  }
}
