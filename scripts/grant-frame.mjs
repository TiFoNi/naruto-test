import { MongoClient, ObjectId } from 'mongodb'
import { FRAMES } from '../packages/core/src/frame-list.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const wear = args.includes('--wear')
const value = (key) => (args.find((one) => one.startsWith(`--${key}=`)) ?? '').slice(key.length + 3)

const who = value('to')
const frame = value('frame')
if (!who) throw new Error('кому: --to=ник | --to=#TAG | --to=<id>')
if (!FRAMES.includes(frame)) throw new Error(`рамка ${frame || '—'} невідома, є: ${FRAMES.join(', ')}`)

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')

const person = ObjectId.isValid(who)
  ? await users.findOne({ _id: new ObjectId(who) }, { projection: { nickname: 1, frames: 1, frame: 1 } })
  : who.startsWith('#')
    ? await users.findOne({ tag: who.slice(1).toUpperCase() }, { projection: { nickname: 1, frames: 1, frame: 1 } })
    : await users.findOne({ nicknameLower: who.toLowerCase() }, { projection: { nickname: 1, frames: 1, frame: 1 } })

if (!person) throw new Error(`не знайшов гравця ${who}`)

const had = (person.frames ?? []).includes(frame)
console.log(`${person.nickname ?? person._id}: ${had ? 'рамка вже є' : `додаємо ${frame}`}${wear ? ' + надягаємо' : ''}`)

if (apply) {
  await users.updateOne({ _id: person._id }, { $addToSet: { frames: frame }, ...(wear ? { $set: { frame } } : {}) })
  console.log('готово')
} else {
  console.log('це перегляд, додай --apply щоб записати')
}

await client.close()
