import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const defaultNickname = (username) => {
  const base = (username ?? '').split('@')[0].replace(/[^\p{L}\p{N} _.\-]/gu, '').slice(0, 24)
  return base.length >= 2 ? base : 'Player'
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const users = db.collection('users')

await users.createIndex({ nicknameLower: 1 })

const list = await users.find({}, { projection: { nickname: 1, username: 1, nicknameLower: 1 } }).toArray()
const ops = []

for (const doc of list) {
  const lower = (doc.nickname ?? defaultNickname(doc.username)).toLowerCase()
  if (doc.nicknameLower === lower) continue
  ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { nicknameLower: lower } } } })
}

if (ops.length) await users.bulkWrite(ops, { ordered: false })

console.log(`користувачів: ${list.length}, оновлено: ${ops.length}, база: ${db.databaseName}`)
await client.close()
