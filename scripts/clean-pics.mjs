import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { knownIds } from './pics-keys.mjs'

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env
const missing = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].filter((key) => !process.env[key])
if (missing.length) {
  console.error(`не задані змінні: ${missing.join(', ')}`)
  process.exit(1)
}

const write = process.argv.includes('--write')

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: !!process.env.R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

const known = await knownIds()

async function remote() {
  const keys = []
  let token
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken: token }))
    for (const object of page.Contents ?? []) keys.push(object.Key)
    token = page.NextContinuationToken
  } while (token)
  return keys
}

function orphan(key) {
  const [world, kind, ...rest] = key.split('/')
  const ids = known.get(world)
  if (!ids) return false
  if (kind === 'thumbs.webp') return false
  if (['full', 'card', 'mini', 'thumb'].includes(kind)) return !ids.has(rest[0]?.replace('.webp', ''))
  if (['pages', 'voice'].includes(kind)) return !ids.has(rest[0])
  return false
}

const keys = await remote()
const junk = keys.filter(orphan)
const byWorld = {}
for (const key of junk) {
  const world = key.split('/')[0]
  byWorld[world] = (byWorld[world] ?? 0) + 1
}

console.log(`у бакеті ${keys.length} об'єктів, зайвих (персонажа вже нема у грі): ${junk.length}`)
for (const [world, count] of Object.entries(byWorld).sort((a, b) => b[1] - a[1])) console.log(`  ${world.padEnd(12)} ${count}`)
if (junk.length) console.log(junk.slice(0, 8).map((key) => `  ${key}`).join('\n'))

if (!junk.length) process.exit(0)
if (!write) {
  console.log('\nпробний прогін, нічого не видалено. щоб видалити: npm run pics:clean -- --write')
  process.exit(0)
}

for (let i = 0; i < junk.length; i += 1000) {
  const batch = junk.slice(i, i + 1000)
  await client.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: batch.map((Key) => ({ Key })) } }))
  console.log(`видалено ${Math.min(i + 1000, junk.length)} з ${junk.length}`)
}
