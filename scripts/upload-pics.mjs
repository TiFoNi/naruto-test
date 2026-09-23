import fs from 'node:fs/promises'
import path from 'node:path'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ROOT, pool } from './lib.mjs'

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

async function collect() {
  const games = await fs.readdir(path.join(ROOT, 'public'), { withFileTypes: true })
  const files = []
  for (const game of games) {
    if (!game.isDirectory() || (only && game.name !== only)) continue

    const full = path.join(ROOT, 'public', game.name, 'full')
    for (const file of await fs.readdir(full).catch(() => [])) {
      if (file.endsWith('.webp')) files.push({ key: `${game.name}/full/${file}`, path: path.join(full, file) })
    }

    const pages = path.join(ROOT, 'public', game.name, 'pages')
    for (const entry of await fs.readdir(pages, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory()) continue
      const dir = path.join(pages, entry.name)
      for (const file of await fs.readdir(dir).catch(() => [])) {
        if (file.endsWith('.webp')) files.push({ key: `${game.name}/pages/${entry.name}/${file}`, path: path.join(dir, file) })
      }
    }
  }
  return files
}

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
  const files = await collect()
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
          ContentType: 'image/webp',
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
