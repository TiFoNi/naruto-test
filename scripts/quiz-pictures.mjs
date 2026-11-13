import { randomBytes } from 'node:crypto'
import { CopyObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { MongoClient } from 'mongodb'
import { GAME_SPECS } from '../packages/game/src/specs.ts'

const apply = process.argv.includes('--apply')

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const bucket = process.env.R2_BUCKET ?? 'nandaguessr'
const s3 = apply
  ? new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: !!process.env.R2_ENDPOINT,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    })
  : null

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')

const names = new Map()
const nameOf = async (game, id) => {
  const key = `${game}:${id}`
  if (!names.has(key)) names.set(key, (await db.collection('entities').findOne({ game, id }, { projection: { name: 1 } }))?.name ?? null)
  return names.get(key)
}

const copy = async (game, id) => {
  const key = `quizzes/${randomBytes(8).toString('hex')}.webp`
  if (apply) {
    await s3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: key,
        CopySource: `${bucket}/${GAME_SPECS[game].images}/full/${id}.webp`,
        MetadataDirective: 'REPLACE',
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
  }
  return { key, ver: randomBytes(4).toString('hex') }
}

const lost = []

const option = async (game, one, where) => {
  if (one?.kind !== 'entity' || !Number.isInteger(one.id)) return [one, 0]
  const text = await nameOf(game, one.id)
  if (!text) {
    lost.push(`${where}: #${one.id}`)
    return [one, 0]
  }
  return [{ kind: 'image', ...(await copy(game, one.id)), text }, 1]
}

const options = async (game, list = [], where) => {
  let changed = 0
  const next = []
  for (const one of list) {
    const [made, done] = await option(game, one, where)
    next.push(made)
    changed += done
  }
  return [next, changed]
}

const picture = async (game, one) => {
  if (one?.kind !== 'entity' || !Number.isInteger(one.id)) return [one, 0]
  return [{ kind: 'upload', ...(await copy(game, one.id)) }, 1]
}

const found = await db.collection('quizzes').find({}).toArray()
let total = 0

for (const quiz of found) {
  if (!GAME_SPECS[quiz.game]) continue
  const where = `[${quiz.game}] ${quiz.title}`
  let changed = 0
  const set = {}

  const [cover, coverDone] = await picture(quiz.game, quiz.cover)
  if (coverDone) set.cover = cover
  changed += coverDone

  if (quiz.entries?.length) {
    const [entries, done] = await options(quiz.game, quiz.entries, where)
    if (done) set.entries = entries
    changed += done
  }

  if (quiz.questions?.length) {
    let touched = 0
    const questions = []
    for (const question of quiz.questions) {
      const next = { ...question }
      if (question.picture) {
        const [pic, done] = await picture(quiz.game, question.picture)
        next.picture = pic
        touched += done
      }
      if (question.kind === 'choice' || question.kind === 'order') {
        const [list, done] = await options(quiz.game, question.options, where)
        next.options = list
        touched += done
      }
      if (question.kind === 'pairs') {
        const [left, doneLeft] = await options(quiz.game, question.left, where)
        const [right, doneRight] = await options(quiz.game, question.right, where)
        next.left = left
        next.right = right
        touched += doneLeft + doneRight
      }
      questions.push(next)
    }
    if (touched) set.questions = questions
    changed += touched
  }

  if (!changed) continue
  total += changed
  console.log(`${where} — ${quiz.status}: ${changed} картинок`)
  if (apply) await db.collection('quizzes').updateOne({ _id: quiz._id }, { $set: set })
}

if (lost.length) console.log(`\nне знайдено в базі (лишаються як є):\n  ${lost.join('\n  ')}`)
console.log(`\nразом: ${total} картинок`)
if (!apply) console.log('це перевірка, нічого не змінено. щоб записати: node --experimental-strip-types --env-file-if-exists=.env.local scripts/quiz-pictures.mjs --apply')

await client.close()
