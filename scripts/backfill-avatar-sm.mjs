import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'

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
const SIDE = 192
const dry = process.argv.includes('--dry')

const keys = []
let token
do {
  const page = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: 'avatars/', ContinuationToken: token }))
  for (const one of page.Contents ?? []) keys.push(one.Key)
  token = page.IsTruncated ? page.NextContinuationToken : undefined
} while (token)

const have = new Set(keys)
const todo = keys.filter((key) => key.endsWith('.webp') && !key.endsWith('-sm.webp') && !have.has(key.replace('.webp', '-sm.webp')))
console.log(`аватарок: ${keys.filter((key) => !key.endsWith('-sm.webp')).length}, без малої копії: ${todo.length}${dry ? ' (пробний прогін)' : ''}`)

let done = 0
for (const key of todo) {
  if (dry) continue
  const answer = await s3.send(new GetObjectCommand({ Bucket, Key: key }))
  const source = Buffer.from(await answer.Body.transformToByteArray())
  const small = await sharp(source).resize(SIDE, SIDE, { kernel: 'lanczos3' }).webp({ quality: 90 }).toBuffer()
  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key: key.replace('.webp', '-sm.webp'),
      Body: small,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
  done += 1
  if (done % 25 === 0) console.log(`  ${done}/${todo.length}`)
}

if (!dry) console.log(`готово: ${done}`)
