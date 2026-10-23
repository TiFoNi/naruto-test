import fs from 'node:fs'
import path from 'node:path'
import { MongoClient } from 'mongodb'
import { ROOT } from './lib.mjs'

const TITLE = 'tester'
const BANNER = 'tester'

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
const apply = process.argv.includes('--apply')

const client = new MongoClient(read('MONGODB_URI'))
await client.connect()
const users = client.db(read('MONGODB_DB') || 'nandaguessr').collection('users')

const need = await users
  .find({ titles: TITLE, banners: { $ne: BANNER } }, { projection: { nickname: 1, username: 1 } })
  .toArray()

console.log(`з титулом «${TITLE}» і без фону «${BANNER}»: ${need.length}`)
for (const one of need) console.log(`  ${one.nickname ?? one.username}`)

if (!apply) {
  console.log('\nце лише перегляд. запусти з --apply, щоб видати')
} else {
  const done = await users.updateMany({ titles: TITLE, banners: { $ne: BANNER } }, { $addToSet: { banners: BANNER } })
  console.log(`\nвидано: ${done.modifiedCount}`)
}

await client.close()
