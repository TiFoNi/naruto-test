import { createHash } from 'node:crypto'
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { GAME_SPECS, shapeOf, type GameId } from '@nanda/game'
import { CELL, derive } from './pictures'

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

const AVATAR = 256

export const avatarKey = (userId: string) => `avatars/${userId}.webp`

export async function uploadAvatar(userId: string, source: Buffer) {
  const image = await sharp(source)
    .rotate()
    .resize(AVATAR, AVATAR, { fit: 'cover', position: 'centre' })
    .webp({ quality: 84 })
    .toBuffer()

  await put(avatarKey(userId), image)
  return version(image)
}

export async function dropAvatar(userId: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: avatarKey(userId) }))
}

export async function uploadPortrait(game: GameId, id: number, source: Buffer) {
  const folder = GAME_SPECS[game].images
  const { full, card, mini, thumb } = await derive(source, shapeOf(game))

  await Promise.all([
    put(`${folder}/full/${id}.webp`, full),
    put(`${folder}/card/${id}.webp`, card),
    put(`${folder}/mini/${id}.webp`, mini),
  ])

  return { version: version(full), thumb }
}

async function get(key: string) {
  const answer = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
  return Buffer.from(await answer.Body!.transformToByteArray())
}

export async function patchAtlas(game: GameId, index: number, cell: Buffer) {
  if (!Number.isInteger(index) || index < 0) return null

  const folder = GAME_SPECS[game].images
  const sheet = await get(`${folder}/thumbs.webp`).catch(() => null)
  if (!sheet) return null

  const { width = 0, height = 0 } = await sharp(sheet).metadata()
  const cols = Math.round(width / CELL)
  if (cols < 1 || index >= cols * Math.round(height / CELL)) return null

  const updated = await sharp(sheet)
    .composite([{ input: cell, left: (index % cols) * CELL, top: Math.floor(index / cols) * CELL }])
    .webp({ quality: 84 })
    .toBuffer()

  await put(`${folder}/thumbs.webp`, updated)
  return version(updated)
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
