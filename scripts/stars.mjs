import fs from 'node:fs'
import path from 'node:path'
import { MongoClient } from 'mongodb'
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
const limit = Number(process.argv[2]) || 15

const token = read('TELEGRAM_BOT_TOKEN')
if (token) {
  const answer = await fetch(`https://api.telegram.org/bot${token}/getStarTransactions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ limit }),
  }).then((response) => response.json())

  const list = answer.result?.transactions ?? []
  console.log(`\nTelegram: ${list.length} транзакцій`)
  for (const one of list) {
    const who = one.source?.user ?? one.receiver?.user
    const name = who?.username ? `@${who.username}` : (who?.first_name ?? '?')
    const payload = one.source?.invoice_payload ?? one.receiver?.invoice_payload ?? ''
    console.log(`  ${new Date(one.date * 1000).toISOString().slice(0, 16)}  ${String(one.amount).padStart(4)}★  ${name}  ${payload}`)
  }
}

const uri = read('MONGODB_URI')
if (!uri) process.exit(0)

const client = new MongoClient(uri)
await client.connect()
const db = client.db(read('MONGODB_DB') || 'nandaguessr')
const people = db.collection('users')
const rows = await db.collection('purchases').find({ way: 'stars' }).sort({ createdAt: -1 }).limit(limit).toArray()

console.log(`\nБаза: ${rows.length} замовлень`)
for (const row of rows) {
  const who = await people.findOne({ _id: row.userId }, { projection: { nickname: 1, username: 1 } })
  const when = row.createdAt?.toISOString().slice(0, 16) ?? '?'
  console.log(
    `  ${when}  ${row.status.padEnd(8)}  ${String(row.stars).padStart(4)}★  ${String(row.base + row.bonus).padStart(5)} монет  ${who?.nickname ?? who?.username ?? '?'}  ${row.orderId}`,
  )
}

const totals = await db
  .collection('purchases')
  .aggregate([{ $match: { way: 'stars' } }, { $group: { _id: '$status', orders: { $sum: 1 }, stars: { $sum: '$stars' } } }, { $sort: { _id: 1 } }])
  .toArray()

console.log('\nРазом:')
for (const one of totals) console.log(`  ${one._id.padEnd(9)} ${String(one.orders).padStart(3)} шт, ${one.stars}★`)
await client.close()
