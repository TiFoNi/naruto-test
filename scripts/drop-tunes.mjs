import fs from 'node:fs/promises'
import path from 'node:path'
import { DeleteObjectsCommand, S3Client } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import { TUNE_CUTS } from '../packages/game/src/specs.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const LIST = path.join(ROOT, 'scripts', 'data', 'tunes.json')
const OUT = path.join(ROOT, 'packages', 'game', 'data', 'tunes.json')
const RAW = path.join(ROOT, '.cache', 'tunes')

const dry = process.argv.includes('--dry')

const list = JSON.parse(await fs.readFile(LIST, 'utf8'))
const doomed = list.filter((row) => row.hidden)

if (!doomed.length) {
  console.log('прихованих немає, нічого видаляти')
  process.exit(0)
}

console.log(`на видалення ${doomed.length}:`)
for (const row of doomed) console.log(`  ${String(row.id).padStart(3)} ${row.nameEn} — ${row.song}`)

if (dry) {
  console.log('\n--dry: нічого не чіпав')
  process.exit(0)
}

const ids = doomed.map((row) => row.id)

const account = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
if (!account || !accessKeyId || !secretAccessKey) throw new Error('немає ключів R2')

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${account}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
})
const Bucket = process.env.R2_BUCKET ?? 'nandaguessr'

const keys = ids.flatMap((id) => TUNE_CUTS.map((seconds) => ({ Key: `tunes/${id}/${seconds}.m4a` })))
for (let from = 0; from < keys.length; from += 900) {
  const slice = keys.slice(from, from + 900)
  await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: slice, Quiet: true } }))
}
console.log(`\nR2: прибрано ${keys.length} файлів`)

const uri = process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL
if (!uri) throw new Error('немає адреси бази')
const client = await MongoClient.connect(uri)
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const { deletedCount } = await db.collection('entities').deleteMany({ game: 'tunes', id: { $in: ids } })
await client.close()
console.log(`база: видалено ${deletedCount} записів`)

const keep = (rows) => rows.filter((row) => !ids.includes(row.id))
await fs.writeFile(LIST, `${JSON.stringify(keep(list), null, 1)}\n`)
const out = JSON.parse(await fs.readFile(OUT, 'utf8').catch(() => '[]'))
await fs.writeFile(OUT, `${JSON.stringify(keep(out), null, 1)}\n`)
console.log(`каталог: лишилось ${keep(list).length}`)

const names = await fs.readdir(RAW).catch(() => [])
let wiped = 0
for (const name of names) {
  if (!ids.includes(Number(name.replace(/\.[^.]+$/, '')))) continue
  await fs.rm(path.join(RAW, name))
  wiped += 1
}
console.log(`локальні файли: прибрано ${wiped}`)
