import { MongoClient, ObjectId } from 'mongodb'

const [who, which] = process.argv.slice(2).filter((one) => !one.startsWith('--'))
if (!who) throw new Error('використання: node scripts/reset-quiz.mjs <пошта або "нік#TAG"> [назва або id тесту] [--dry]')

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const [nickname, tag] = who.split('#')
const query = who.includes('@') ? { usernameLower: who.toLowerCase() } : { nicknameLower: nickname.toLowerCase(), tag }
const dry = process.argv.includes('--dry')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')

const person = await db.collection('users').findOne(query, { projection: { nickname: 1, tag: 1 } })
if (!person) throw new Error(`не знайдено ${who}`)

const quizzes = await db
  .collection('quizzes')
  .find(which ? (ObjectId.isValid(which) ? { _id: new ObjectId(which) } : { title: which }) : {}, { projection: { title: 1 } })
  .toArray()
if (which && !quizzes.length) throw new Error(`тест «${which}» не знайдено`)

const attempts = db.collection('quizAttempts')
const found = await attempts.find({ userId: person._id, quizId: { $in: quizzes.map((quiz) => quiz._id) } }).toArray()
const titles = new Map(quizzes.map((quiz) => [quiz._id.toHexString(), quiz.title]))

console.log(`${person.nickname}#${person.tag}: проходжень ${found.length}`)
for (const one of found) {
  console.log(`  «${titles.get(one.quizId.toHexString())}» — ${one.finished ? `завершено, ${one.score}/${one.total}` : `розпочато, відповідей ${one.answers.length}`}, разів ${one.runs ?? 1}`)
}

if (!found.length) console.log('нічого скидати')
else if (dry) console.log(`скинув би ${found.length} (пробний прогін)`)
else {
  const { deletedCount } = await attempts.deleteMany({ _id: { $in: found.map((one) => one._id) } })
  console.log(`скинуто ${deletedCount} — тепер як не пройдений, перше проходження знову дасть досвід`)
}

await client.close()
