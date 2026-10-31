import { MongoClient, ObjectId } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')

const QUESTION = 'Зачем Солнечные пираты рисовали солнце на теле?'
const FROM = 'Как символ свободы рыболюдей'
const TO = 'Чтобы отпугивать морских королей'

const client = new MongoClient(uri)
await client.connect()
const quizzes = client.db(process.env.MONGODB_DB || 'nandaguessr').collection('quizzes')
const quiz = await quizzes.findOne({ _id: new ObjectId('6ae5a75b4c09274c06548d02') })
const at = quiz?.questions.findIndex((one) => one.text === QUESTION) ?? -1
const option = at >= 0 ? quiz.questions[at].options.findIndex((one) => one.text === FROM) : -1
if (option < 0) console.log('варіант не знайдено — можливо, вже змінено')
else {
  await quizzes.updateOne({ _id: quiz._id }, { $set: { [`questions.${at}.options.${option}.text`]: TO, updatedAt: new Date() } })
  console.log(`питання ${at + 1}: «${FROM}» → «${TO}»`)
}
await client.close()
