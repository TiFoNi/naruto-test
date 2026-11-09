import { MongoClient, ObjectId } from 'mongodb'
import { BANNERS } from '../packages/game/src/specs.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const wear = args.includes('--wear')
const value = (key) => (args.find((one) => one.startsWith(`--${key}=`)) ?? '').slice(key.length + 3)

const who = value('to')
const banner = value('banner')
if (!who) throw new Error('кому: --to=ник | --to=#TAG | --to=<id>')
if (!BANNERS.includes(banner)) throw new Error(`фон ${banner || '—'} невідомий, є: ${BANNERS.join(', ')}`)

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')

const projection = { nickname: 1, banners: 1, banner: 1 }
const person = ObjectId.isValid(who)
  ? await users.findOne({ _id: new ObjectId(who) }, { projection })
  : who.startsWith('#')
    ? await users.findOne({ tag: who.slice(1).toUpperCase() }, { projection })
    : await users.findOne({ nicknameLower: who.toLowerCase() }, { projection })

if (!person) throw new Error(`не знайшов гравця ${who}`)

const had = (person.banners ?? []).includes(banner)
console.log(`${person.nickname ?? person._id}: ${had ? 'фон вже є' : `додаємо ${banner}`}${wear ? ' + надягаємо' : ''}`)

if (apply) {
  await users.updateOne(
    { _id: person._id },
    { ...(had ? {} : { $addToSet: { banners: banner, bannersGiven: banner } }), ...(wear ? { $set: { banner } } : {}) },
  )
  console.log('готово')
} else {
  console.log('це перегляд, додай --apply щоб записати')
}

await client.close()
