import { MongoClient, ObjectId } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const tiger = await db.collection('entities').findOne({ game: 'onepiece', nameEn: 'Fisher Tiger' }, { projection: { id: 1 } })
if (!tiger) throw new Error('Фишера Тайгера немає в базі')
const { matchedCount } = await db
  .collection('quizzes')
  .updateOne({ _id: new ObjectId('6ae5a75b4c09274c06548d02') }, { $set: { cover: { kind: 'entity', id: tiger.id }, updatedAt: new Date() } })
console.log(matchedCount ? `обкладинка — Фишер Тайгер (id ${tiger.id})` : 'тест не знайдено')
await client.close()
