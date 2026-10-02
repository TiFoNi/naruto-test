import fs from 'node:fs/promises'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { pool } from './lib.mjs'
import { collectPics } from './pics-keys.mjs'

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].filter((k) => !process.env[k])
if (missing.length) {
  console.error(`не задані змінні: ${missing.join(', ')} — додай їх у .env.local`)
  process.exit(1)
}

const only = process.argv[2]
const force = process.argv.includes('--force')

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

async function exists(key, size) {
  if (force) return false
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return head.ContentLength === size
  } catch {
    return false
  }
}

async function main() {
  const files = await collectPics(only)
  if (!files.length) return console.log(only ? `у public/${only} нічого не знайшов` : 'картинок не знайшов')
  console.log(`знайшов ${files.length} картинок${only ? ` (гра ${only})` : ''}`)

  let uploaded = 0
  let skipped = 0
  let failed = 0
  await pool(files, 12, async ({ key, path: file }) => {
    const body = await fs.readFile(file)
    if (await exists(key, body.length)) {
      skipped++
      return
    }
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: body,
          ContentType: key.endsWith('.mp3') ? 'audio/mpeg' : 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      )
      uploaded++
      if (uploaded % 100 === 0) console.log(`  залито ${uploaded}…`)
    } catch (error) {
      failed++
      console.warn('не залилось', key, error.message)
    }
  })

  console.log(`готово: залито ${uploaded}, пропущено (вже там) ${skipped}, помилок ${failed}`)
}

main()
