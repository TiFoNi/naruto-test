import { MongoClient, ObjectId } from 'mongodb'
import { FRAMES } from '../packages/core/src/frame-list.ts'

const who = process.argv[2]
const picked = process.argv.slice(3).filter((arg) => !arg.startsWith('-'))
const frames = picked.length ? picked : [...FRAMES]
const take = process.argv.includes('--take')

if (!who) {
  console.error('вкажи гравця: npm run frames -- <нік|пошта|id> [рамки…] [--take]')
  process.exit(1)
}

const wrong = frames.filter((frame) => !FRAMES.includes(frame))
if (wrong.length) {
  console.error(`невідомі рамки: ${wrong.join(', ')} (є: ${FRAMES.join(', ')})`)
  process.exit(1)
}

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')

const query = ObjectId.isValid(who)
  ? { _id: new ObjectId(who) }
  : { $or: [{ nicknameLower: who.toLowerCase() }, { usernameLower: who.toLowerCase() }, { username: who }] }

const doc = await users.findOne(query, { projection: { nickname: 1, username: 1, frames: 1, frame: 1 } })
if (!doc) {
  console.error('гравця не знайшов')
  await client.close()
  process.exit(1)
}

const update = take
  ? { $pull: { frames: { $in: frames } }, ...(frames.includes(doc.frame) ? { $unset: { frame: '' } } : {}) }
  : { $addToSet: { frames: { $each: frames } } }

await users.updateOne({ _id: doc._id }, update)
const after = await users.findOne({ _id: doc._id }, { projection: { frames: 1, frame: 1 } })

console.log(`${doc.nickname ?? doc.username}: ${take ? 'забрав' : 'видав'} ${frames.join(', ')}`)
console.log(`тепер має: ${(after?.frames ?? []).join(', ') || 'нічого'}${after?.frame ? ` | носить: ${after.frame}` : ''}`)
await client.close()
