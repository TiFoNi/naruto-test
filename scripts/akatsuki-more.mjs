import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const dry = process.argv.includes('--dry')

const entity = (id) => ({ kind: 'entity', id })
const text = (value) => ({ kind: 'text', text: value })

const TITLE = 'Акацуки: всё об организации'
const DROP = 'Соедини Путь Пейна с его способностью.'

const MORE = [
  {
    kind: 'order',
    text: 'Расставь членов Акацуки в порядке их гибели.',
    options: [entity(1042), entity(558), entity(193), entity(1293), entity(861), entity(421)],
  },
  { kind: 'bool', text: 'Какузу в молодости сражался с Первым Хокаге.', answer: true },
  {
    kind: 'choice',
    text: 'Кто из людей Орочимару был шпионом Сасори?',
    multi: false,
    options: [entity(1359), entity(637), entity(1203), entity(521)],
    correct: [0],
  },
  {
    kind: 'choice',
    text: 'Сколько хвостатых Акацуки запечатали до начала войны?',
    multi: false,
    options: [text('5'), text('6'), text('7'), text('9')],
    correct: [2],
  },
  {
    kind: 'choice',
    text: 'Сколько взрывных печатей Конан подготовила против Обито?',
    multi: false,
    options: [text('6 миллионов'), text('6 миллиардов'), text('600 миллиардов'), text('60 тысяч')],
    correct: [2],
  },
  {
    kind: 'choice',
    text: 'Сколько длилась пытка Цукуёми, в которую Итачи погрузил Какаши?',
    multi: false,
    options: [text('24 часа'), text('48 часов'), text('72 часа'), text('7 дней')],
    correct: [2],
  },
  {
    kind: 'choice',
    text: 'Какие артефакты были в Сусаноо Итачи?',
    multi: true,
    options: [text('Меч Тоцука'), text('Меч Кусанаги'), text('Зеркало Ята'), text('Магатама Ясакани'), text('Веер Утива'), text('Самехада')],
    correct: [0, 2],
  },
  {
    kind: 'choice',
    text: 'Каково истинное происхождение Белых Зецу?',
    multi: false,
    options: [
      text('Созданы из клеток Хаширамы в лаборатории Орочимару'),
      text('Люди, попавшие под Бесконечное Цукуёми Кагуи и превращённые Деревом-Богом'),
      text('Восставшие духи шиноби времён Мудреца Шести Путей'),
      text('Неудачные клоны Тобирамы Сенджу'),
    ],
    correct: [1],
  },
  {
    kind: 'choice',
    text: 'Чьё кольцо Акацуки носил Тоби?',
    multi: false,
    options: [entity(928), entity(1042), entity(558), entity(193)],
    correct: [1],
  },
  {
    kind: 'choice',
    text: 'Откуда у Дейдары рты на ладонях?',
    multi: false,
    options: [
      text('Это кеккей генкай его клана'),
      text('Украл запретную технику Деревни Камня'),
      text('Их пришил ему Сасори'),
      text('Последствие экспериментов Орочимару'),
    ],
    correct: [1],
  },
]

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const quizzes = db.collection('quizzes')

const quiz = await quizzes.findOne({ game: 'naruto', title: TITLE })
if (!quiz) throw new Error(`тест «${TITLE}» не знайдено`)

const ids = new Set(MORE.flatMap((question) => (question.options ?? []).filter((one) => one.kind === 'entity').map((one) => one.id)))
const found = await db.collection('entities').find({ game: 'naruto', id: { $in: [...ids] }, answer: true }, { projection: { id: 1 } }).toArray()
const missing = [...ids].filter((id) => !found.some((one) => one.id === id))
if (missing.length) throw new Error(`немає в пулі: ${missing.join(', ')} — нічого не записав`)

const kept = quiz.questions.filter((question) => question.text !== DROP)
const added = MORE.filter((question) => !kept.some((one) => one.text === question.text))
const questions = [...kept, ...added]

console.log(`прибираю питань: ${quiz.questions.length - kept.length}, додаю: ${added.length}, стане ${questions.length}`)
for (const [at, question] of questions.entries()) console.log(`  ${at + 1}. [${question.kind}] ${question.text}`)

if (dry) console.log('пробний прогін — нічого не записав')
else {
  await quizzes.updateOne({ _id: quiz._id }, { $set: { questions, updatedAt: new Date() } })
  await db.collection('quizAttempts').updateMany({ quizId: quiz._id, finished: false }, { $set: { answers: [] } })
  console.log('готово — тест лишається чернеткою')
}

await client.close()
