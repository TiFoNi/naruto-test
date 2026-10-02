import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MongoClient } from 'mongodb'
import { GAME_SPECS } from '../packages/game/src/specs.ts'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'packages', 'game', 'data')
const NAMES = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'data', 'names-uk.json'), 'utf8'))

let changed = 0
let missing = 0

for (const [file, names] of Object.entries(NAMES)) {
  const target = path.join(DATA, `${file}.json`)
  if (!fs.existsSync(target)) {
    console.warn(`немає ${file}.json`)
    continue
  }

  const list = JSON.parse(fs.readFileSync(target, 'utf8'))
  const seen = new Set()
  for (const entity of list) {
    const uk = names[entity.name]
    if (!uk) continue
    seen.add(entity.name)
    if (entity.nameUk === uk) continue
    entity.nameUk = uk
    changed++
  }

  for (const name of Object.keys(names)) {
    if (!seen.has(name)) {
      console.warn(`${file}: немає персонажа «${name}»`)
      missing++
    }
  }

  fs.writeFileSync(target, JSON.stringify(list, null, 1))
}

console.log(`проставлено ${changed} українських імен, не знайдено ${missing}`)

if (!process.argv.includes('--db')) process.exit(0)

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const entities = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('entities')

let saved = 0
for (const [file, names] of Object.entries(NAMES)) {
  const game = Object.entries(GAME_SPECS).find(([, spec]) => spec.data === file)?.[0] ?? file
  const ops = Object.entries(names).map(([name, nameUk]) => ({
    updateOne: { filter: { game, name }, update: { $set: { nameUk } } },
  }))
  const result = ops.length ? await entities.bulkWrite(ops, { ordered: false }) : { modifiedCount: 0 }
  saved += result.modifiedCount
  console.log(`  ${game.padEnd(11)} оновлено ${result.modifiedCount}`)
}

console.log(`у базі ${client.db(process.env.MONGODB_DB || 'nandaguessr').databaseName} оновлено ${saved}`)
await client.close()
