import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const arg = (name) => {
  const at = process.argv.indexOf(`--${name}`)
  return at > 0 ? process.argv[at + 1] : undefined
}
const nick = arg('nick')
const title = arg('title')
const text = arg('text')
if (!nick || !title || !text) throw new Error('потрібно --nick, --title і --text')
const write = process.argv.includes('--write')

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')
const found = await users.find({ nicknameLower: nick.toLowerCase() }, { projection: { nickname: 1, tag: 1 } }).toArray()
if (found.length !== 1) {
  console.log(found.length ? `таких ніків ${found.length}: ${found.map((one) => `${one.nickname}#${one.tag}`).join(', ')}` : 'нікого не знайшли')
  await client.close()
  process.exit(1)
}
const [user] = found
console.log(`кому: ${user.nickname}#${user.tag ?? ''}\nзаголовок: ${title}\nтекст: ${text}`)
if (write) {
  await users.updateOne({ _id: user._id }, { $push: { systemNews: { $each: [{ id: randomUUID(), title, text, at: new Date() }], $slice: -10 } } })
  console.log('надіслано')
} else console.log('\nце перевірка, нічого не надіслано; для відправки додай --write')
await client.close()
