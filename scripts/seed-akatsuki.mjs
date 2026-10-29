import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const dry = process.argv.includes('--dry')

const entity = (id) => ({ kind: 'entity', id })
const text = (value) => ({ kind: 'text', text: value })

const QUIZ = {
  game: 'naruto',
  title: 'Акацуки: всё об организации',
  layout: 'steps',
  cover: entity(861),
  questions: [
    {
      kind: 'pairs',
      text: 'Соедини Путь Пейна с его способностью.',
      left: [text('Путь Дэвы'), text('Путь Асуры'), text('Путь Претов'), text('Путь Нараки'), text('Путь Животных'), text('Путь Людей')],
      right: [
        text('Притяжение и отталкивание'),
        text('Механическое тело с оружием'),
        text('Поглощение чакры'),
        text('Король Ада, восстанавливающий тела'),
        text('Призыв'),
        text('Вырывание души'),
      ],
    },
    { kind: 'name', text: 'Чьё тело Нагато использовал как Путь Дэвы?', answer: 1356 },
    {
      kind: 'choice',
      text: 'Как Нагато управлял Шестью Путями на расстоянии?',
      multi: false,
      options: [text('Нитями чакры, как марионетками'), text('Через Шаринган Обито'), text('Чёрными стержнями-приёмниками чакры'), text('Печатями на телах')],
      correct: [2],
    },
    {
      kind: 'choice',
      text: 'Кто основал Акацуки?',
      multi: true,
      options: [entity(1303), entity(1356), entity(1299), entity(861), entity(928), entity(684)],
      correct: [1, 3, 5],
    },
    {
      kind: 'choice',
      text: 'Какой иероглиф был на кольце Итачи?',
      multi: false,
      options: [text('零 — «ноль»'), text('空 — «пустота»'), text('朱 — «алый»'), text('青 — «синий»')],
      correct: [2],
    },
    {
      kind: 'choice',
      text: 'Почему Орочимару ушёл из Акацуки?',
      multi: false,
      options: [text('Его выгнал Пейн'), text('Пытался захватить тело Итачи и проиграл'), text('Ушёл основать Деревню Звука'), text('Его раскрыл Сасори')],
      correct: [1],
    },
    {
      kind: 'choice',
      text: 'Сколько сердец было у Какузу перед боем с командой Асумы?',
      multi: false,
      options: [text('3'), text('4'), text('5'), text('6')],
      correct: [2],
    },
    {
      kind: 'choice',
      text: 'Что нужно Хидану для проклятия Дзясина?',
      multi: false,
      options: [text('Коснуться противника'), text('Посмотреть ему в глаза'), text('Назвать имя жертвы'), text('Кровь противника и стоять в своём символе')],
      correct: [3],
    },
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
