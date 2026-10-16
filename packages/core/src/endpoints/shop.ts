import { COIN_PACKS, PAY_COINS } from '@nanda/game'
import { chargeUsd, feeUsd, purchaseState, startPurchase } from '../coins'
import { fail, handle, json, readJson } from '../http'
import { floorUsd, minsUsd, provider } from '../payments'
import { currentUser, unauthorized } from '../profile'
import { starsReady } from '../telegram'

export const GET = handle(async (request) => {
  const order = new URL(request.url).searchParams.get('order')
  if (!order) {
    const mins = provider.ready ? await minsUsd() : {}
    const coins = PAY_COINS.filter((one) => provider.coins.includes(one.id)).map((one) => ({ ...one, least: mins[one.id] ?? null }))
    const least = provider.ready ? await floorUsd() : null
    const packs = COIN_PACKS.map((one) => ({ ...one, charge: chargeUsd(one.usd), fee: feeUsd(one.usd) }))
    return json({ packs, coins, live: provider.ready, stars: starsReady(), least })
  }

  const found = await currentUser(request)
  if (!found) return unauthorized()

  const state = await purchaseState(found.doc._id!, order)
  return state ? json(state) : fail(404, 'no_order')
})

export const POST = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()

  const { pack, coin, way } = (await readJson(request)) as { pack?: unknown; coin?: unknown; way?: unknown }
  const started = await startPurchase(found.doc._id!, pack, coin, way ?? 'crypto')
  if (started === 'bad_pack') return fail(400, 'bad_request')
  if (started === 'off') return fail(503, 'payments_off')
  if ('tooSmall' in started) return json({ error: 'coin_min', least: started.tooSmall }, 409)

  return json(started)
})
