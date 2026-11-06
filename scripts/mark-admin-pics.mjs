import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import { GAME_SPECS } from '../packages/game/src/specs.ts'
import { ROOT } from './lib.mjs'

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, MONGODB_URI, MONGODB_DB } = process.env
const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'MONGODB_URI'].filter((key) => !process.env[key])
if (missing.length) {
  console.error(`не задані змінні: ${missing.join(', ')}`)
  process.exit(1)
}

const write = process.argv.includes('--write')

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const version = (buffer) => createHash('sha1').update(buffer).digest('hex').slice(0, 8)

async function get(key) {
  try {
    const answer = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return Buffer.from(await answer.Body.transformToByteArray())
  } catch {
    return null
  }
}

async function pagesOf(prefix) {
  const answer = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix }))
  return (answer.Contents ?? [])
    .map(({ Key }) => Key)
    .sort((a, b) => Number(a.split('/').pop().replace('.webp', '')) - Number(b.split('/').pop().replace('.webp', '')))
}

async function mark(key) {
  const info = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => null)
  if (!info || info.Metadata?.source === 'admin') return false
  if (write)
    await s3.send(
      new CopyObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        CopySource: `${R2_BUCKET}/${encodeURI(key)}`,
        MetadataDirective: 'REPLACE',
        Metadata: { source: 'admin' },
        ContentType: info.ContentType,
        CacheControl: info.CacheControl,
      }),
    )
  return true
}

const mongo = new MongoClient(MONGODB_URI)
await mongo.connect()
const rows = await mongo
  .db(MONGODB_DB || 'nandaguessr')
  .collection('entities')
  .find({ image: { $exists: true } }, { projection: { _id: 0, game: 1, id: 1, name: 1, image: 1 } })
  .toArray()
await mongo.close()

const built = new Map()
const builtImage = (game, id) => {
  if (!built.has(game)) {
    const file = path.join(ROOT, 'packages', 'game', 'data', `${GAME_SPECS[game].data}.json`)
    const list = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []
    built.set(game, new Map(list.map((entity) => [entity.id, entity.image])))
  }
  return built.get(game).get(id)
}

let marked = 0
const lost = []

for (const row of rows) {
  const folder = GAME_SPECS[row.game]?.images
  if (!folder) continue
  const full = await get(`${folder}/full/${row.id}.webp`)
  if (full && version(full) === row.image) {
    for (const kind of ['full', 'card', 'hd', 'mini', 'thumb']) if (await mark(`${folder}/${kind}/${row.id}.webp`)) marked++
    continue
  }
  const pages = await pagesOf(`${folder}/pages/${row.id}/`)
  const heads = await Promise.all(pages.map(async (key) => (await get(key))?.subarray(0, 64) ?? Buffer.alloc(0)))
  if (pages.length && version(Buffer.concat(heads)) === row.image) {
    for (const key of pages) if (await mark(key)) marked++
    continue
  }
  if (builtImage(row.game, row.id) !== row.image) lost.push(`${row.game}: ${row.name}`)
}

console.log(`${write ? 'позначено' : 'треба позначити'} ${marked} файлів з адмінки`)
if (lost.length) console.log(`у R2 вже не адмінська версія (${lost.length}), завантаж наново через адмінку:\n  ${lost.join('\n  ')}`)
if (!write && marked) console.log('\nпробний прогін, нічого не змінено. щоб позначити: npm run pics:mark -- --write')
