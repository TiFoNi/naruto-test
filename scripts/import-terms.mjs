import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'
import { VALUES } from '../apps/web/src/i18n/values.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'packages', 'game', 'data')

const SKIP = new Set(['id', 'thumb', 'answer', 'hidden', 'name', 'nameEn', 'nameUk', 'aliases', 'slug'])

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const terms = db.collection('terms')

await terms.createIndex({ value: 1 }, { unique: true })

const found = new Set()

for (const file of fs.readdirSync(DATA)) {
  if (!file.endsWith('.json') || file.includes('atlas')) continue
  let list
  try {
    list = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'))
  } catch {
    continue
  }
  if (!Array.isArray(list)) continue

  for (const entity of list) {
    for (const [key, value] of Object.entries(entity)) {
      if (SKIP.has(key)) continue
      if (typeof value === 'string') found.add(value)
      else if (Array.isArray(value)) value.forEach((v) => typeof v === 'string' && found.add(v))
    }
  }
}

const ops = [...found].map((value) => {
  const known = VALUES[value]
  return {
    updateOne: {
      filter: { value },
      update: { $setOnInsert: { value, uk: known?.[0] ?? '', en: known?.[1] ?? '' } },
      upsert: true,
    },
  }
})

const result = await terms.bulkWrite(ops, { ordered: false })
const missing = await terms.countDocuments({ $or: [{ uk: '' }, { en: '' }] })

console.log(`значень знайдено: ${found.size}`)
console.log(`додано нових:     ${result.upsertedCount}`)
console.log(`без перекладу:    ${missing}`)

await client.close()
