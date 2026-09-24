import { createHash } from 'node:crypto'
import { DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { GAME_SPECS, type GameId } from '@nanda/game'

const CARD = { width: 288, height: 384 }
const FULL = { width: 800, height: 900 }
const CACHE = 'public, max-age=31536000, immutable'

let client: S3Client | null = null

const bucket = () => process.env.R2_BUCKET ?? 'nandaguessr'

function s3() {
  const account = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!account || !accessKeyId || !secretAccessKey) throw new Error('R2 не налаштовано')

  const local = process.env.R2_ENDPOINT

  client ??= new S3Client({
    region: 'auto',
    endpoint: local ?? `https://${account}.r2.cloudflarestorage.com`,
    forcePathStyle: !!local,
    credentials: { accessKeyId, secretAccessKey },
  })
  return client
}

async function put(key: string, body: Buffer) {
  await s3().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: 'image/webp', CacheControl: CACHE }),
  )
}

export const version = (buffer: Buffer) => createHash('sha1').update(buffer).digest('hex').slice(0, 8)

export async function uploadPortrait(game: GameId, id: number, source: Buffer) {
  const folder = GAME_SPECS[game].images
  const trimmed = await sharp(source).trim().png().toBuffer()

  const full = await sharp(trimmed)
    .resize({ ...FULL, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 })
    .toBuffer()

  const card = await sharp(trimmed).resize(CARD.width, CARD.height, { fit: 'cover', position: 'top' }).webp({ quality: 80 }).toBuffer()

  await Promise.all([put(`${folder}/full/${id}.webp`, full), put(`${folder}/card/${id}.webp`, card)])
  return version(full)
}

export async function uploadPages(game: GameId, id: number, sources: Buffer[]) {
  const folder = GAME_SPECS[game].images

  const pages = await Promise.all(
    sources.map(async (source, index) => {
      const page = await sharp(source)
        .resize({ width: 1200, height: 1800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
      await put(`${folder}/pages/${id}/${index + 1}.webp`, page)
      return page
    }),
  )

  return { count: pages.length, version: version(Buffer.concat(pages.map((p) => p.subarray(0, 64)))) }
}

export async function dropPictures(game: GameId, id: number) {
  const folder = GAME_SPECS[game].images
  const client = s3()
  const Bucket = bucket()

  for (const Key of [`${folder}/full/${id}.webp`, `${folder}/card/${id}.webp`]) {
    await client.send(new DeleteObjectCommand({ Bucket, Key }))
  }

  const pages = await client.send(new ListObjectsV2Command({ Bucket, Prefix: `${folder}/pages/${id}/` }))
  const keys = (pages.Contents ?? []).map(({ Key }) => ({ Key: Key as string }))
  if (keys.length) await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys } }))

  return 2 + keys.length
}

export async function dropPages(game: GameId, id: number, from: number, to: number) {
  const folder = GAME_SPECS[game].images
  for (let page = from; page <= to; page++) {
    await s3()
      .send(new DeleteObjectCommand({ Bucket: bucket(), Key: `${folder}/pages/${id}/${page}.webp` }))
      .catch(() => undefined)
  }
}
