import { createHash, createHmac, randomBytes } from 'node:crypto'
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
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

export const ADMIN_SOURCE = { source: 'admin' }

async function put(key: string, body: Buffer, admin = false) {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: CACHE,
      Metadata: admin ? ADMIN_SOURCE : undefined,
    }),
  )
}

const hidden = new Set<string>()
const hiding = new Map<string, Promise<boolean>>()

const hiddenKey = (key: string, tag: string, secret: string) =>
  `x/${createHmac('sha256', secret).update(`${key}#${tag}`).digest('hex').slice(0, 32)}.${key.split('.').pop()}`

async function hide(source: string, target: string) {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: target }))
    return true
  } catch {
    try {
      await s3().send(new CopyObjectCommand({ Bucket: bucket(), Key: target, CopySource: `${bucket()}/${source}`, MetadataDirective: 'COPY' }))
      return true
    } catch {
      return false
    }
  }
}

export async function hiddenUrl(key: string, tag = '') {
  const secret = process.env.PICS_SECRET
  const pics = process.env.PICS_URL?.replace(/\/+$/, '')
  if (!secret || !pics) return null
  const target = hiddenKey(key, tag, secret)
  if (!hidden.has(target)) {
    let job = hiding.get(target)
    if (!job) {
      job = hide(key, target).finally(() => hiding.delete(target))
      hiding.set(target, job)
    }
    if (!(await job)) return null
    hidden.add(target)
  }
  return `${pics}/${target}`
}

export const sendTo = (url: string, cache: string) => new Response(null, { status: 302, headers: { location: url, 'cache-control': cache } })

export const version = (buffer: Buffer) => createHash('sha1').update(buffer).digest('hex').slice(0, 8)

const AVATAR = 384

const AVATAR_SMALL = 192

export const avatarKey = (userId: string) => `avatars/${userId}.webp`

export const smallAvatarKey = (userId: string) => `avatars/${userId}-sm.webp`

export const smallAvatar = (image: Buffer) =>
  sharp(image).resize(AVATAR_SMALL, AVATAR_SMALL, { kernel: 'lanczos3' }).webp({ quality: 90 }).toBuffer()

export async function uploadAvatar(userId: string, source: Buffer) {
  const image = await sharp(source)
    .rotate()
    .resize(AVATAR, AVATAR, { fit: 'cover', position: 'centre' })
    .webp({ quality: 92 })
    .toBuffer()

  await Promise.all([put(avatarKey(userId), image), put(smallAvatarKey(userId), await smallAvatar(image))])
  return version(image)
}

export async function dropAvatar(userId: string) {
  await s3().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: [{ Key: avatarKey(userId) }, { Key: smallAvatarKey(userId) }], Quiet: true },
    }),
  )
}

export async function uploadPortrait(game: GameId, id: number, source: Buffer) {
  const folder = GAME_SPECS[game].images
  const { full, card, hd, mini, thumb } = await derive(source, shapeOf(game))

  await Promise.all([
    put(`${folder}/full/${id}.webp`, full, true),
    put(`${folder}/card/${id}.webp`, card, true),
    put(`${folder}/hd/${id}.webp`, hd, true),
    put(`${folder}/mini/${id}.webp`, mini, true),
    put(`${folder}/thumb/${id}.webp`, thumb, true),
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
      await put(`${folder}/pages/${id}/${index + 1}.webp`, page, true)
      return page
    }),
  )

  return { count: pages.length, version: version(Buffer.concat(pages.map((p) => p.subarray(0, 64)))) }
}

export async function dropPictures(game: GameId, id: number) {
  const folder = GAME_SPECS[game].images
  const client = s3()
  const Bucket = bucket()

  for (const Key of [`${folder}/full/${id}.webp`, `${folder}/card/${id}.webp`, `${folder}/hd/${id}.webp`, `${folder}/mini/${id}.webp`, `${folder}/thumb/${id}.webp`]) {
    await client.send(new DeleteObjectCommand({ Bucket, Key }))
  }

  const pages = await client.send(new ListObjectsV2Command({ Bucket, Prefix: `${folder}/pages/${id}/` }))
  const keys = (pages.Contents ?? []).map(({ Key }) => ({ Key: Key as string }))
  if (keys.length) await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys } }))

  return 5 + keys.length
}

export async function dropPages(game: GameId, id: number, from: number, to: number) {
  const folder = GAME_SPECS[game].images
  for (let page = from; page <= to; page++) {
    await s3()
      .send(new DeleteObjectCommand({ Bucket: bucket(), Key: `${folder}/pages/${id}/${page}.webp` }))
      .catch(() => undefined)
  }
}

const FRAME = { width: 1920, height: 1080 }
const FRAME_MIN = 1280

const frameBox = (width: number) => {
  const side = Math.min(FRAME.width, Math.max(FRAME_MIN, width))
  return { width: side, height: Math.round((side * 9) / 16) }
}
const SHOT_CARD = { width: 288, height: 384 }
const SHOTS = 'shots'

export const frameKey = (id: number, level: number, name: string) => `${SHOTS}/frames/${id}/${level}/${name}.webp`

async function unbarred(source: Buffer) {
  const full = await sharp(source).metadata()
  const cut = await sharp(source)
    .trim({ background: '#000000', threshold: 18 })
    .toBuffer({ resolveWithObject: true })
    .catch(() => null)
  if (!cut) return source
  const left = (cut.info.width * cut.info.height) / ((full.width ?? 1) * (full.height ?? 1))
  return left > 0.5 ? cut.data : source
}

export async function uploadFrames(id: number, level: number, sources: Buffer[]) {
  const names: string[] = []
  for (const source of sources) {
    const plain = await unbarred(source)
    const { width = 0 } = await sharp(plain).metadata()
    const stretched = width < FRAME_MIN
    const frame = await sharp(plain)
      .resize({ ...frameBox(width), fit: 'cover', position: 'attention', kernel: 'lanczos3' })
      .sharpen(stretched ? { sigma: 1.1, m1: 0.6, m2: 2 } : { sigma: 0.5 })
      .webp({ quality: 88 })
      .toBuffer()
    const name = randomBytes(6).toString('hex')
    await put(frameKey(id, level, name), frame)
    names.push(name)
  }
  return names
}

export async function deleteFrame(id: number, level: number, name: string) {
  await s3()
    .send(new DeleteObjectCommand({ Bucket: bucket(), Key: frameKey(id, level, name) }))
    .catch(() => undefined)
}

export async function uploadShotCard(id: number, level: number, name: string) {
  const frame = await get(frameKey(id, level, name)).catch(() => null)
  if (!frame) return null
  const card = await sharp(frame)
    .resize({ ...SHOT_CARD, fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toBuffer()
  await put(`${SHOTS}/card/${id}.webp`, card)
  return version(card)
}

export async function uploadQuizCover(source: Buffer, wide = false) {
  const cover = await sharp(source)
    .rotate()
    .resize({ width: 640, height: wide ? 480 : 640, fit: 'cover', position: 'centre' })
    .webp({ quality: 84 })
    .toBuffer()
  const key = `quizzes/${randomBytes(8).toString('hex')}.webp`
  await put(key, cover)
  return { key, ver: version(cover) }
}
