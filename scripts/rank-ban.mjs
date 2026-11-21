import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const at = process.argv.indexOf('--nick')
const nicks = at > 0 ? (process.argv[at + 1] ?? '').split(',').map((one) => one.trim()).filter(Boolean) : []
const list = process.argv.includes('--list')
if (!nicks.length && !list) throw new Error('потрібно --nick нік1,нік2 [--off] або --list')
const off = process.argv.includes('--off')
const write = process.argv.includes('--write')

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')

if (list) {
  const banned = await users.find({ rankBan: { $exists: true } }, { projection: { nickname: 1, tag: 1, rankBan: 1 }, sort: { rankBan: -1 } }).toArray()
  console.log(banned.length ? banned.map((one) => `${one.nickname}#${one.tag ?? ''} — з ${one.rankBan.toISOString().slice(0, 16).replace('T', ' ')}`).join('\n') : 'нікого немає в бані рейтингу')
}

for (const nick of nicks) {
  const found = await users.find({ nicknameLower: nick.toLowerCase() }, { projection: { nickname: 1, tag: 1, rankBan: 1 } }).toArray()
  if (found.length !== 1) {
    console.log(`${nick}: ${found.length ? 'кілька акаунтів з таким ніком' : 'не знайдено'}, пропускаю`)
    continue
  }
  const [user] = found
  const name = `${user.nickname}#${user.tag ?? ''}`
  if (off ? !user.rankBan : user.rankBan) {
    console.log(`${name}: ${off ? 'і так не в бані' : 'вже в бані'}`)
    continue
  }
  console.log(`${name}: ${off ? 'повернути в рейтинг' : 'прибрати з рейтингу'}`)
  if (write) await users.updateOne({ _id: user._id }, off ? { $unset: { rankBan: '' } } : { $set: { rankBan: new Date() } })
}

if (nicks.length) console.log(write ? 'готово' : '\nце перевірка, нічого не змінено; для запису додай --write')
await client.close()
