import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const dry = process.argv.includes('--dry')

const entity = (id) => ({ kind: 'entity', id })
const text = (value) => ({ kind: 'text', text: value })

const QUIZ = {
  game: 'naruto',
  title: 'Настоящий шиноби: экзамен по Наруто',
  layout: 'steps',
  cover: entity(1344),
  questions: [
    {
      kind: 'choice',
      text: 'Кто научил Наруто Расенгану?',
      multi: false,
      options: [entity(376), entity(1325), entity(515), entity(865)],
      correct: [2],
    },
    { kind: 'bool', text: 'Итачи уничтожил клан Учиха по приказу верхушки Конохи.', answer: true },
    {
      kind: 'order',
      text: 'Расставь Хокаге от Первого к Шестому.',
      options: [entity(1063), entity(1066), entity(1036), entity(865), entity(1280), entity(376)],
    },
    { kind: 'name', text: 'Кто запечатал Девятихвостого в новорождённом Наруто?', answer: 865 },
    {
      kind: 'choice',
      text: 'Кто из них был джинчурики?',
      multi: true,
      options: [entity(259), entity(636), entity(739), entity(898), entity(444), entity(878)],
      correct: [0, 1, 3],
    },
    {
      kind: 'pairs',
      text: 'Соедини учителя с его учеником.',
      left: [entity(515), entity(1036), entity(865), entity(344)],
      right: [entity(861), entity(928), entity(376), entity(739)],
    },
    {
      kind: 'choice',
      text: 'Что Итачи тайно передал Наруто при их встрече?',
      multi: false,
      options: [text('Печать с Аматэрасу'), text('Ворону с Мангекё Шисуи'), text('Часть своей чакры'), text('Свиток с запретной техникой')],
      correct: [1],
    },
    { kind: 'bool', text: 'Обито был в одной команде с Какаши и Рин под руководством Минато.', answer: true },
    {
      kind: 'order',
      text: 'Расставь события по хронологии.',
      options: [
        text('Экзамен на чуунина'),
        text('Погоня за Саске'),
        text('Гибель Джирайи'),
        text('Нападение Пейна на Коноху'),
        text('Четвёртая мировая война шиноби'),
      ],
    },
    {
      kind: 'pairs',
      text: 'Соедини хвостатого с его джинчурики.',
      left: [entity(1127), entity(480), entity(345), entity(711)],
      right: [entity(259), entity(591), entity(636), entity(1344)],
    },
    {
      kind: 'choice',
      text: 'Кто основал Акацуки?',
      multi: false,
      options: [entity(861), entity(1303), entity(1299), entity(1356)],
      correct: [3],
    },
    { kind: 'name', text: 'Кто был джинчурики Девятихвостого до Наруто?', answer: 1341 },
  ],
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const quizzes = db.collection('quizzes')

const ids = new Set([QUIZ.cover.id])
for (const question of QUIZ.questions) {
  if (question.kind === 'name') ids.add(question.answer)
  for (const option of [...(question.options ?? []), ...(question.left ?? []), ...(question.right ?? [])]) {
    if (option.kind === 'entity') ids.add(option.id)
  }
}
const found = await db
  .collection('entities')
  .find({ game: QUIZ.game, id: { $in: [...ids] }, answer: true }, { projection: { id: 1 } })
  .toArray()
const missing = [...ids].filter((id) => !found.some((one) => one.id === id))

if (missing.length) {
  console.log(`немає в пулі: ${missing.join(', ')} — нічого не записав`)
} else if (await quizzes.findOne({ game: QUIZ.game, title: QUIZ.title })) {
  console.log('такий тест уже є — пропускаю')
} else if (dry) {
  console.log(`створив би чернетку «${QUIZ.title}» (${QUIZ.questions.length} питань), усі ${ids.size} персонажів у пулі`)
} else {
  const now = new Date()
  const { insertedId } = await quizzes.insertOne({ ...QUIZ, status: 'draft', official: true, createdAt: now, updatedAt: now })
  console.log(`створено чернетку ${insertedId} — відкрий в адмінці /admin/quizzes`)
}

await client.close()
