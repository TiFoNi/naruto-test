import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'

const LEVELS = 4
const GAME = 'shots'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const account = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
if (!account || !accessKeyId || !secretAccessKey) throw new Error('немає ключів R2')

const dry = process.argv.includes('--dry')

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${account}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
})
const Bucket = process.env.R2_BUCKET ?? 'nandaguessr'

const counts = new Map()
let token
do {
  const page = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: `${GAME}/frames/`, ContinuationToken: token }))
  for (const object of page.Contents ?? []) {
    const hit = object.Key.match(/^shots\/frames\/(\d+)\/(\d+)\/\d+\.webp$/)
    if (!hit) continue
    const id = Number(hit[1])
    const level = Number(hit[2])
    if (level >= LEVELS) continue
    if (!counts.has(id)) counts.set(id, Array.from({ length: LEVELS }, () => 0))
    counts.get(id)[level] += 1
  }
  token = page.IsTruncated ? page.NextContinuationToken : undefined
} while (token)

const client = new MongoClient(uri)
await client.connect()
const entities = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('entities')

const docs = await entities.find({ game: GAME }, { projection: { _id: 0, id: 1, nameEn: 1, frames: 1, answer: 1 } }).sort({ id: 1 }).toArray()

const ops = []
for (const doc of docs) {
  const real = counts.get(doc.id) ?? Array.from({ length: LEVELS }, () => 0)
  const held = Array.isArray(doc.frames) ? doc.frames : []
  const same = real.every((value, level) => value === (Number(held[level]) || 0))
  const answer = real.some((value) => value > 0)
  if (same && doc.answer === answer) continue

  console.log(`  ${String(doc.id).padStart(3)} ${doc.nameEn.slice(0, 36).padEnd(36)} ${JSON.stringify(held)} → ${JSON.stringify(real)}`)
  ops.push({
    updateOne: {
      filter: { game: GAME, id: doc.id },
      update: { $set: { frames: real, answer, ver: Date.now().toString(36), updatedAt: new Date() } },
    },
  })
}

if (!ops.length) console.log('усе збігається, нічого міняти')
else if (dry) console.log(`\n--dry: мав би оновити ${ops.length}`)
else {
  const result = await entities.bulkWrite(ops, { ordered: false })
  console.log(`\nоновлено ${result.modifiedCount}`)
}

const playable = docs.filter((doc) => (counts.get(doc.id) ?? []).some((value) => value > 0)).length
console.log(`тайтлів із картинками: ${playable}`)

await client.close()
