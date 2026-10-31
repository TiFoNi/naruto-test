import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const dry = process.argv.includes('--dry')

const entity = (id) => ({ kind: 'entity', id })
const text = (value) => ({ kind: 'text', text: value })

const QUIZ = {
  game: 'onepiece',
  title: 'Солнечные пираты и Фишер Тайгер',
  layout: 'steps',
  cover: null,
  questions: [
    {
      kind: 'choice',
      text: 'Кого Солнечные пираты отвезли домой на остров Фулшаут?',
      multi: false,
      options: [entity(73893), entity(1558), entity(10318), entity(17494)],
      correct: [0],
    },
    {
      kind: 'choice',
      text: 'Зачем Солнечные пираты рисовали солнце на теле?',
      multi: false,
      options: [
        text('Чтобы скрыть клеймо рабов Небесных драконов'),
        text('Как символ свободы рыболюдей'),
        text('Как знак союза с Белоусом'),
        text('В честь клятвы Отохиме'),
      ],
      correct: [0],
    },
    { kind: 'bool', text: 'Фишер Тайгер в одиночку взобрался на Красную линию и освободил рабов Мари Джоа.', answer: true },
    {
      kind: 'choice',
      text: 'Почему Тайгер умер, хотя ему могли перелить кровь?',
      multi: false,
      options: [text('Отказался принимать человеческую кровь'), text('На корабле не нашлось донора'), text('Его отравили морпехи'), text('Погиб прямо в бою')],
      correct: [0],
    },
    {
      kind: 'choice',
      text: 'Что Коала поначалу делала на корабле Тайгера из страха?',
      multi: false,
      options: [text('Улыбалась и драила палубу, как рабыня'), text('Пряталась в трюме'), text('Пыталась сбежать'), text('Готовила для всей команды')],
      correct: [0],
    },
    { kind: 'name', text: 'Кто стал капитаном Солнечных пиратов после смерти Тайгера?', answer: 2044 },
    {
      kind: 'choice',
      text: 'Как Арлонг вышел из тюрьмы Морского дозора?',
      multi: false,
      options: [
        text('Его отпустили, когда Джимбей стал Шичибукаем'),
        text('Сбежал во время шторма'),
        text('Его выкупила Большая мамочка'),
        text('Ему помог Крокодайл'),
      ],
      correct: [0],
    },
    {
      kind: 'order',
      text: 'Расставь события по порядку.',
      options: [
        text('Тайгер освобождает рабов Мари Джоа'),
        text('Основание Солнечных пиратов'),
        text('Коалу возвращают домой'),
        text('Гибель Тайгера'),
        text('Джимбей становится Шичибукаем'),
        text('Арлонг уходит в Ист Блю'),
      ],
    },
  ],
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const quizzes = db.collection('quizzes')

const ids = new Set()
for (const question of QUIZ.questions) {
  if (question.kind === 'name') ids.add(question.answer)
  for (const option of question.options ?? []) if (option.kind === 'entity') ids.add(option.id)
}
const found = await db.collection('entities').find({ game: QUIZ.game, id: { $in: [...ids] }, answer: true }, { projection: { id: 1 } }).toArray()
const missing = [...ids].filter((id) => !found.some((one) => one.id === id))

if (missing.length) console.log(`немає в пулі: ${missing.join(', ')} — нічого не записав`)
else if (await quizzes.findOne({ game: QUIZ.game, title: QUIZ.title })) console.log('такий тест уже є — пропускаю')
else if (dry) console.log(`створив би чернетку «${QUIZ.title}» (${QUIZ.questions.length} питань), усі ${ids.size} персонажів у пулі`)
else {
  const now = new Date()
  const { insertedId } = await quizzes.insertOne({ ...QUIZ, status: 'draft', official: true, createdAt: now, updatedAt: now })
  console.log(`створено чернетку ${insertedId} — відкрий в адмінці /admin/quizzes`)
}

await client.close()
