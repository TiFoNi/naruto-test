import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'
import { GAME_IDS } from '../packages/game/src/specs.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILL = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'data', 'terms-fill.json'), 'utf8'))

const write = process.argv.includes('--write')
const date = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? new Date().toISOString().slice(0, 10)

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const name = process.env.MONGODB_DB || 'nandaguessr'
const db = client.db(name)
console.log(`база: ${name}, дата: ${date}, режим: ${write ? 'запис' : 'пробний прогін'}\n`)

const terms = db.collection('terms')
const known = new Map((await terms.find({}).toArray()).map((t) => [t.value, t]))

let filled = 0
for (const term of FILL) {
  const row = known.get(term.value)
  if (!row) {
    console.log('немає в базі:', term.value)
    continue
  }
  if (row.uk && row.en) continue
  filled++
  if (write) await terms.updateOne({ value: term.value }, { $set: { uk: term.uk, en: term.en } })
}

const settings = db.collection('settings')
const dated = new Map((await settings.find({}).toArray()).map((s) => [s.game, s.updated]))

let stamped = 0
for (const game of GAME_IDS) {
  if (dated.get(game)) continue
  stamped++
  if (write) await settings.updateOne({ game }, { $set: { updated: date } }, { upsert: true })
}

const left = (await terms.find({}).toArray()).filter((t) => !t.uk || !t.en).length
console.log(`перекладів ${write ? 'записано' : 'до запису'}: ${filled}`)
console.log(`дат ${write ? 'проставлено' : 'до простановки'}: ${stamped}`)
console.log(`без перекладу лишається: ${write ? left : left - filled}`)
if (!write) console.log('\nнічого не змінено — додай --write')

await client.close()
