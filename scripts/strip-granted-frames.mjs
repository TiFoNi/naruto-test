import { MongoClient, ObjectId } from 'mongodb'
import { FRAMES } from '../packages/core/src/frame-list.ts'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const keepRaw = (args.find((one) => one.startsWith('--keep=')) ?? '').slice('--keep='.length)
if (!keepRaw) throw new Error('вкажи, кому лишити: --keep=ник або --keep=#TAG або --keep=<id>')

const client = new MongoClient(uri)
await client.connect()
const users = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('users')

const keeper = ObjectId.isValid(keepRaw)
  ? await users.findOne({ _id: new ObjectId(keepRaw) }, { projection: { nickname: 1 } })
  : keepRaw.startsWith('#')
    ? await users.findOne({ tag: keepRaw.slice(1).toUpperCase() }, { projection: { nickname: 1 } })
    : await users.findOne({ nicknameLower: keepRaw.toLowerCase() }, { projection: { nickname: 1 } })

if (!keeper) throw new Error(`не знайшов гравця ${keepRaw}`)

const granted = [...FRAMES]
const list = await users
  .find({ _id: { $ne: keeper._id }, frames: { $in: granted } }, { projection: { nickname: 1, frames: 1, frame: 1 } })
  .toArray()

let touched = 0
for (const doc of list) {
  const losing = (doc.frames ?? []).filter((one) => granted.includes(one))
  if (!losing.length) continue
  touched++
  const wearing = granted.includes(doc.frame ?? '') ? ' + знімаємо надіту' : ''
  console.log(`${doc.nickname ?? doc._id}: ${losing.join(', ')}${wearing}`)
  if (!apply) continue
  await users.updateOne(
    { _id: doc._id },
    granted.includes(doc.frame ?? '')
      ? { $pull: { frames: { $in: granted } }, $unset: { frame: '' } }
      : { $pull: { frames: { $in: granted } } },
  )
}

console.log(`${apply ? 'знято' : 'знялося б'} у ${touched} гравців, лишили все для ${keeper.nickname ?? keeper._id}`)
await client.close()
