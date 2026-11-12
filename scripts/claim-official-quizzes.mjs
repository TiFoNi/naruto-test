import { MongoClient } from 'mongodb'

const apply = process.argv.includes('--apply')
const who = process.argv.slice(2).find((arg) => !arg.startsWith('--'))

if (!who || !who.includes('#')) {
  console.log('вкажи нік з тегом: node --env-file-if-exists=.env.local scripts/claim-official-quizzes.mjs "Нік#TAG" [--apply]')
  process.exit(1)
}

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')

const [nickname, tag] = who.split('#')
const people = await db
  .collection('users')
  .find({ nicknameLower: nickname.trim().toLowerCase(), tag: tag.trim().toUpperCase() }, { projection: { nickname: 1, tag: 1 } })
  .toArray()

if (people.length !== 1) {
  console.log(people.length ? `знайдено кілька акаунтів «${who}», уточни` : `акаунт «${who}» не знайдено`)
  await client.close()
  process.exit(1)
}

const owner = people[0]
const orphans = await db
  .collection('quizzes')
  .find({ official: true, authorId: { $exists: false } }, { projection: { title: 1, game: 1, status: 1 } })
  .sort({ createdAt: 1 })
  .toArray()

console.log(`автор: ${owner.nickname}#${owner.tag} (${owner._id})`)
console.log(`офіційних тестів без автора: ${orphans.length}`)
for (const quiz of orphans) console.log(`  [${quiz.game}] ${quiz.title} — ${quiz.status}`)

if (!apply) {
  console.log(`\nце перевірка, нічого не змінено. щоб записати: node --env-file-if-exists=.env.local scripts/claim-official-quizzes.mjs "${who}" --apply`)
} else if (orphans.length) {
  const done = await db
    .collection('quizzes')
    .updateMany({ _id: { $in: orphans.map((quiz) => quiz._id) }, authorId: { $exists: false } }, { $set: { authorId: owner._id } })
  console.log(`\nзаписано автором: ${done.modifiedCount}`)
}

await client.close()
