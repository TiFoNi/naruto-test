import fs from 'node:fs'
import path from 'node:path'
import { MongoClient, ObjectId } from 'mongodb'
import { ROOT } from './lib.mjs'

const file = path.join(ROOT, '.env.local')
const env = fs.existsSync(file)
  ? Object.fromEntries(
      fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => line.includes('='))
        .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]),
    )
  : {}

const read = (name) => process.env[name] ?? env[name] ?? ''
const [nickname, asked] = process.argv.slice(2)
const coins = Number(asked)

if (!nickname || !Number.isFinite(coins) || coins === 0) {
  console.log('використання: npm run coins -- <нік> <скільки>')
  process.exit(1)
}

const client = new MongoClient(read('MONGODB_URI'))
await client.connect()
const db = client.db(read('MONGODB_DB') || 'nandaguessr')
const people = db.collection('users')

const who = await people.findOne({ nicknameLower: nickname.toLowerCase() }, { projection: { nickname: 1, coins: 1 } })
if (!who) {
  console.log(`гравця «${nickname}» не знайшов`)
  await client.close()
  process.exit(1)
}

await db.collection('coinLedger').insertOne({ userId: who._id, delta: coins, reason: 'purchase', purchaseId: new ObjectId(), at: new Date() })
await people.updateOne({ _id: who._id }, { $inc: { coins }, $set: { coinsNews: { coins, at: new Date() } } })

const after = await people.findOne({ _id: who._id }, { projection: { coins: 1 } })
console.log(`${who.nickname}: ${who.coins ?? 0} → ${after?.coins ?? 0} монет (+${coins}), сповіщення поставлено`)
await client.close()
