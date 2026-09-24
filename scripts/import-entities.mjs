import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'
import { GAME_SPECS } from '../packages/game/src/specs.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'packages', 'game', 'data')

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const entities = db.collection('entities')

await entities.createIndex({ game: 1, id: 1 }, { unique: true })
await entities.createIndex({ game: 1, answer: 1, hidden: 1 })

const updatedAt = new Date()
let total = 0

for (const [game, spec] of Object.entries(GAME_SPECS)) {
  const file = path.join(DATA, `${spec.data}.json`)
  if (!fs.existsSync(file)) {
    console.log(`  ${game}: немає ${spec.data}.json, пропускаю`)
    continue
  }

  const list = JSON.parse(fs.readFileSync(file, 'utf8'))
  const ops = list.map((entity) => ({
    updateOne: {
      filter: { game, id: entity.id },
      update: { $set: { ...entity, game, updatedAt } },
      upsert: true,
    },
  }))

  const result = await entities.bulkWrite(ops, { ordered: false })
  const stale = await entities.deleteMany({ game, updatedAt: { $lt: updatedAt } })
  total += list.length
  console.log(
    `  ${game.padEnd(9)} додано ${String(result.upsertedCount).padStart(4)}, оновлено ${String(result.modifiedCount).padStart(4)}` +
      (stale.deletedCount ? `, прибрано зайвих ${stale.deletedCount}` : ''),
  )
}

console.log(`\nусього ${total} персонажів у базі ${db.databaseName}`)
await client.close()
