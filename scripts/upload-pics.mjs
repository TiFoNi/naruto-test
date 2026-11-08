import fs from 'node:fs/promises'
import path from 'node:path'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { GAME_SPECS, shapeOf } from '../packages/game/src/specs.ts'
import { CELL, derive } from '../packages/core/src/pictures.ts'
import { ROOT, pool } from './lib.mjs'
import { UI_DIRS, collectPics } from './pics-keys.mjs'

const TYPES = { mp3: 'audio/mpeg', webp: 'image/webp', png: 'image/png', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm' }

const UI_CACHE = 'public, max-age=86400, stale-while-revalidate=604800'
const FRAMES_CACHE = 'public, max-age=604800, stale-while-revalidate=2592000'
const ATLAS = /^[^/]+\/thumbs\.webp$/

const cacheOf = (key) => {
  const folder = key.split('/')[0]
  if (folder === 'frames' || folder === 'banners') return FRAMES_CACHE
  return UI_DIRS.includes(folder) ? UI_CACHE : 'public, max-age=31536000, immutable'
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].filter((k) => !process.env[k])
if (missing.length) {
  console.error(`не задані змінні: ${missing.join(', ')} — додай їх у .env.local`)
  process.exit(1)
}

const only = process.argv[2]?.startsWith('--') ? undefined : process.argv[2]
const force = process.argv.includes('--force')
const match = process.argv.find((arg) => arg.startsWith('--match='))?.slice('--match='.length).split(',').filter(Boolean)

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

async function head(key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  } catch {
    return null
  }
}

async function get(key) {
  try {
    const answer = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return Buffer.from(await answer.Body.transformToByteArray())
  } catch {
    return null
  }
}

const put = (key, body) =>
  client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: TYPES[key.split('.').pop()] ?? 'application/octet-stream',
      CacheControl: cacheOf(key),
    }),
  )

const fromAdmin = (info) => info?.Metadata?.source === 'admin'

const specOf = (folder) => Object.entries(GAME_SPECS).find(([, spec]) => spec.images === folder)

async function thumbsOf(folder) {
  const found = specOf(folder)
  if (!found) return new Map()
  const raw = await fs.readFile(path.join(ROOT, 'packages', 'game', 'data', `${found[1].data}.json`), 'utf8').catch(() => '[]')
  return new Map(JSON.parse(raw).map((entity) => [String(entity.id), entity.thumb]))
}

async function adminThumb(folder, id) {
  const ready = await get(`${folder}/thumb/${id}.webp`)
  if (ready) return ready
  const full = await get(`${folder}/full/${id}.webp`)
  if (!full) return null
  const found = specOf(folder)
  return (await derive(full, found ? shapeOf(found[0]) : 'square')).thumb
}

async function patchAtlas(file, folder, ids) {
  const thumbs = await thumbsOf(folder)
  const { width = 0, height = 0 } = await sharp(file).metadata()
  const cols = Math.round(width / CELL)
  const cells = cols * Math.round(height / CELL)
  const layers = []
  for (const id of ids) {
    const index = thumbs.get(id)
    if (!Number.isInteger(index) || index < 0 || index >= cells) continue
    const cell = await adminThumb(folder, id)
    if (!cell) continue
    const input = await sharp(cell).resize(CELL, CELL, { fit: 'cover' }).toBuffer()
    layers.push({ input, left: (index % cols) * CELL, top: Math.floor(index / cols) * CELL })
  }
  if (!layers.length) return 0
  const patched = await sharp(await fs.readFile(file))
    .composite(layers)
    .webp({ quality: 84 })
    .toBuffer()
  await fs.writeFile(file, patched)
  return layers.length
}

async function main() {
  if (only === 'shots') console.warn('увага: кадри в R2 редагуються через адмінку, локальні файли можуть повернути видалені кадри')
  const files = (await collectPics(only)).filter(({ key }) => !match || match.some((part) => key.includes(part)))
  if (!files.length) return console.log(only ? `у public/${only} нічого не знайшов` : 'картинок не знайшов')
  console.log(`знайшов ${files.length} картинок${only ? ` (гра ${only})` : ''}`)

  let uploaded = 0
  let skipped = 0
  let failed = 0
  const kept = []
  const portraits = new Map()

  const send = async (key, body) => {
    try {
      await put(key, body)
      uploaded++
      if (uploaded % 100 === 0) console.log(`  залито ${uploaded}…`)
    } catch (error) {
      failed++
      console.warn('не залилось', key, error.message)
    }
  }

  const kindOf = (key) => key.split('/')[1]
  const SIDE = new Set(['card', 'hd', 'mini'])
  const shielded = (key) => {
    const [folder, kind, name] = key.split('/')
    return SIDE.has(kind) && (portraits.get(folder) ?? []).includes(name.replace('.webp', ''))
  }
  const loose = files.filter(({ key }) => !ATLAS.test(key))

  const handle = async ({ key, path: file }) => {
    const body = await fs.readFile(file)
    const info = await head(key)
    if (shielded(key) && !fromAdmin(info)) {
      kept.push(key)
      if (info) {
        const remote = await get(key)
        if (remote) await fs.writeFile(file, remote)
      }
      return
    }
    if (fromAdmin(info)) {
      kept.push(key)
      const [folder, kind, name] = key.split('/')
      if (kind === 'full') portraits.set(folder, [...(portraits.get(folder) ?? []), name.replace('.webp', '')])
      if (info.ContentLength !== body.length) {
        const remote = await get(key)
        if (remote) await fs.writeFile(file, remote)
      }
      return
    }
    if (!force && info?.ContentLength === body.length) {
      skipped++
      return
    }
    await send(key, body)
  }

  await pool(
    loose.filter(({ key }) => kindOf(key) === 'full'),
    12,
    handle,
  )
  await pool(
    loose.filter(({ key }) => kindOf(key) !== 'full'),
    12,
    handle,
  )

  for (const { key, path: file } of files.filter(({ key }) => ATLAS.test(key))) {
    const folder = key.split('/')[0]
    const ids = portraits.get(folder) ?? []
    const patched = ids.length ? await patchAtlas(file, folder, ids) : 0
    if (patched) console.log(`  ${folder}: в атлас повернуто ${patched} портретів з адмінки`)
    const body = await fs.readFile(file)
    const info = await head(key)
    if (!force && info?.ContentLength === body.length) {
      skipped++
      continue
    }
    await send(key, body)
  }

  if (kept.length) console.log(`не чіпав ${kept.length} картинок з адмінки (локальні копії оновлено з R2)`)
  console.log(`готово: залито ${uploaded}, пропущено (вже там) ${skipped}, помилок ${failed}`)
}

main()
