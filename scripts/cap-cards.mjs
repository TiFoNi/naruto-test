import { MongoClient } from 'mongodb'
import { CARD_MAX_LEVEL } from '../packages/game/src/specs.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const write = process.argv.includes('--write')

const client = new MongoClient(uri)
await client.connect()
const cards = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('cards')

const over = { xp: { $gt: CARD_MAX_LEVEL } }
const count = await cards.countDocuments(over)
const owners = await cards.distinct('userId', over)
console.log(`карток понад ${CARD_MAX_LEVEL}: ${count}, гравців: ${owners.length}`)

if (write) {
  const { modifiedCount } = await cards.updateMany(over, { $set: { xp: CARD_MAX_LEVEL } })
  console.log(`обрізано до ${CARD_MAX_LEVEL}: ${modifiedCount}`)
} else {
  console.log('це перевірка, нічого не змінено; для запису додай --write')
}

await client.close()
