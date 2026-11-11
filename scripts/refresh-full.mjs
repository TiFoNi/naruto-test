import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import { GAME_SPECS } from '../packages/game/src/specs.ts'
import { pool } from './lib.mjs'

const [game, dir] = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const mode = process.argv.includes('--db') ? 'db' : process.argv.includes('--r2') ? 'r2' : null
if (!game || !dir || !mode || !GAME_SPECS[game]) {
  console.error('використання: node scripts/refresh-full.mjs <гра> <папка з webp> --r2 | --db')
  process.exit(1)
}

const folder = GAME_SPECS[game].images
const version = (buffer) => createHash('sha1').update(buffer).digest('hex').slice(0, 8)
const files = (await fs.readdir(dir)).filter((name) => /^\d+\.webp$/.test(name))

if (mode === 'r2') {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  })
  let sent = 0
  let failed = 0
  await pool(files, 8, async (name) => {
    const key = `${folder}/full/${name}`
    try {
      await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: await fs.readFile(path.join(dir, name)),
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
          Metadata: { source: 'admin' },
        }),
      )
      sent++
    } catch (error) {
      failed++
      console.warn('не залилось', key, error.message)
    }
  })
  console.log(`${game}: залито ${sent}, помилок ${failed}`)
}

if (mode === 'db') {
  const client = new MongoClient(process.env.MONGODB_URI)
  const entities = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('entities')
  const ops = []
  for (const name of files) {
    const id = Number(name.replace('.webp', ''))
    ops.push({ updateOne: { filter: { game, id }, update: { $set: { image: version(await fs.readFile(path.join(dir, name))) } } } })
  }
  const result = await entities.bulkWrite(ops, { ordered: false })
  console.log(`${game}: нова версія картинки в ${result.modifiedCount} з ${files.length} персонажів`)
  await client.close()
}
