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

const LIVE_FIELDS = { shots: ['frames', 'frameNames', 'answer', 'ver'] }

const updatedAt = new Date()
const only = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
const overwrite = process.argv.includes('--overwrite-admin')
let total = 0

for (const [game, spec] of Object.entries(GAME_SPECS)) {
  if (only && game !== only) continue
  const file = path.join(DATA, `${spec.data}.json`)
  if (!fs.existsSync(file)) {
    console.log(`  ${game}: немає ${spec.data}.json, пропускаю`)
    continue
  }

  const list = JSON.parse(fs.readFileSync(file, 'utf8'))
  const owned = LIVE_FIELDS[game] ?? []
  const touched = await entities.find({ game, 'edited.0': { $exists: true } }).toArray()
  const byId = new Map(touched.map((doc) => [doc.id, doc]))
  const kept = []
  const ops = list.map((entity) => {
    const seeded = Object.fromEntries(owned.filter((field) => field in entity).map((field) => [field, entity[field]]))
    const set = { ...entity, game, updatedAt }
    for (const field of owned) delete set[field]
    const live = byId.get(entity.id)
    if (live && !overwrite) {
      for (const field of live.edited) {
        if (!(field in set)) continue
        if (JSON.stringify(set[field]) !== JSON.stringify(live[field])) kept.push(`${entity.name ?? entity.id}: ${field}`)
        delete set[field]
      }
    }
    if (overwrite) return { updateOne: { filter: { game, id: entity.id }, update: { $set: set, $unset: { edited: '' }, ...(Object.keys(seeded).length ? { $setOnInsert: seeded } : {}) }, upsert: true } }

    return {
      updateOne: {
        filter: { game, id: entity.id },
        update: Object.keys(seeded).length ? { $set: set, $setOnInsert: seeded } : { $set: set },
        upsert: true,
      },
    }
  })

  const result = await entities.bulkWrite(ops, { ordered: false })
  const stale = await entities.deleteMany({ game, updatedAt: { $lt: updatedAt } })
  total += list.length
  console.log(
    `  ${game.padEnd(9)} додано ${String(result.upsertedCount).padStart(4)}, оновлено ${String(result.modifiedCount).padStart(4)}` +
      (stale.deletedCount ? `, прибрано зайвих ${stale.deletedCount}` : ''),
  )
  if (kept.length) {
    console.log(`    лишив правки з адмінки, хоча в JSON інакше (${kept.length}):`)
    for (const line of kept) console.log(`      ${line}`)
    console.log('    щоб перезаписати їх даними з JSON — додай --overwrite-admin')
  }
}

console.log(`\nусього ${total} персонажів у базі ${db.databaseName}`)
await client.close()
