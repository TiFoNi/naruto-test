import { MongoClient } from 'mongodb'
import { CARD_RARITIES, CARD_UP, DUST_CRAFT } from '../packages/game/src/specs.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const write = process.argv.includes('--write')
const pick = (flag) => process.argv.find((arg) => arg.startsWith(`--${flag}=`))?.split('=')[1]
const game = pick('game') ?? 'naruto'
const named = process.argv.slice(2).filter((arg) => !arg.startsWith('--')).map((name) => name.toLowerCase())

const CARDS = 4
const top = CARD_RARITIES.length - 1
const perCard = CARD_UP.slice(0, top).reduce((sum, need) => sum + need * DUST_CRAFT, 0)
const dust = perCard * CARDS

const admins = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)
if (!named.length && !admins.length) throw new Error('ADMIN_EMAILS порожній')

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')

const filter = named.length ? { nicknameLower: { $in: named } } : { usernameLower: { $in: admins } }
const found = await users.find(filter, { projection: { nickname: 1, dust: 1 } }).toArray()
console.log(`${game} · ${CARD_RARITIES[top]}: ${perCard} пилу за картку · ×${CARDS} = ${dust} кожному`)
const had = (one) => (typeof one.dust === 'object' ? (one.dust?.[game] ?? 0) : 0)
for (const one of found) console.log(`  ${one.nickname ?? one._id}: ${had(one)} → ${had(one) + dust}${typeof one.dust === 'number' ? ' (старий спільний пил, спершу npm run dust:split)' : ''}`)
console.log(`знайдено: ${found.length} з ${named.length || admins.length}`)

if (!write) console.log('\nпрогін без запису. додай --write')
else {
  const res = await users.updateMany({ _id: { $in: found.map((one) => one._id) }, dust: { $not: { $type: 'number' } } }, { $inc: { [`dust.${game}`]: dust } })
  console.log('пил видано:', res.modifiedCount)
}

await client.close()
