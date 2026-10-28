import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI не задано')
const dry = process.argv.includes('--dry')

const entity = (id) => ({ kind: 'entity', id })
const ability = (hero, key) => ({ kind: 'ability', hero, key })
const text = (value) => ({ kind: 'text', text: value })

const QUIZZES = [
  {
    game: 'naruto',
    title: 'Акацуки и Коноха',
    layout: 'steps',
    questions: [
      {
        kind: 'choice',
        text: 'Кто из этих персонажей состоял в Акацуки?',
        multi: true,
        options: [entity(1293), entity(421), entity(376), entity(193), entity(259), entity(1042)],
        correct: [0, 1, 3, 5],
      },
      { kind: 'name', text: 'Кто был наставником команды 7 (Наруто, Саске, Сакура)?', answer: 376 },
      {
        kind: 'choice',
        text: 'Какой хвостатый запечатан в Наруто?',
        multi: false,
        options: [text('Однохвостый'), text('Восьмихвостый'), text('Девятихвостый'), text('Семихвостый')],
        correct: [2],
      },
      {
        kind: 'choice',
        text: 'Кто младший брат Итачи Учихи?',
        multi: false,
        options: [entity(1307), entity(1310), entity(1303), entity(1299)],
        correct: [0],
      },
      { kind: 'name', text: 'Кто стал Первым Хокаге?', answer: 1063 },
      { kind: 'name', text: 'Кто был учителем Наруто и автором книги «Приди, приди, рай»?', answer: 515 },
    ],
  },
  {
    game: 'naruto',
    title: 'Хокаге и их техники',
    layout: 'steps',
    questions: [
      { kind: 'bool', text: 'Минато Намиказе — отец Наруто.', answer: true },
      { kind: 'bool', text: 'Цунаде была Третьим Хокаге.', answer: false },
      {
        kind: 'order',
        text: 'Расставь Хокаге по порядку — от Первого к Пятому.',
        options: [entity(1063), entity(1066), entity(1036), entity(865), entity(1280)],
      },
      {
        kind: 'pairs',
        text: 'Соедини персонажа с его техникой.',
        left: [entity(444), entity(878), entity(259), entity(1293)],
        right: [text('Бьякуган'), text('Техника подражания тени'), text('Песчаный гроб'), text('Цукуёми')],
      },
      { kind: 'bool', text: 'Рок Ли может использовать ниндзюцу.', answer: false },
    ],
  },
  {
    game: 'dota',
    title: 'Герои и способности',
    layout: 'list',
    questions: [
      {
        kind: 'choice',
        text: 'Какая из этих способностей принадлежит Pudge?',
        multi: false,
        options: [ability(2, 'axe_berserkers_call'), ability(14, 'pudge_meat_hook'), ability(1, 'antimage_blink'), ability(5, 'crystal_maiden_crystal_nova')],
        correct: [1],
      },
      { kind: 'name', text: 'Чья ультимативная способность — Mana Void?', answer: 1 },
      {
        kind: 'choice',
        text: 'Какие из этих героев — силачи (основной атрибут — сила)?',
        multi: true,
        options: [entity(2), entity(14), entity(1), entity(5)],
        correct: [0, 1],
      },
      {
        kind: 'choice',
        text: 'Сколько игроков в одной команде в обычном матче?',
        multi: false,
        options: [text('3'), text('4'), text('5'), text('6')],
        correct: [2],
      },
      {
        kind: 'choice',
        text: 'Какие способности есть у Invoker?',
        multi: true,
        options: [ability(74, 'invoker_cold_snap'), ability(8, 'juggernaut_blade_fury'), ability(74, 'invoker_tornado'), ability(14, 'pudge_rot')],
        correct: [0, 2],
      },
    ],
  },
]

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || 'nandaguessr')
const quizzes = db.collection('quizzes')
const entities = db.collection('entities')

for (const quiz of QUIZZES) {
  const ids = new Set()
  for (const question of quiz.questions) {
    if (question.kind === 'name') ids.add(question.answer)
    for (const option of [...(question.options ?? []), ...(question.left ?? []), ...(question.right ?? [])]) if (option.kind === 'entity' || option.kind === 'ability') ids.add(option.id ?? option.hero)
  }
  const found = await entities.find({ game: quiz.game, id: { $in: [...ids] } }, { projection: { id: 1 } }).toArray()
  const missing = [...ids].filter((id) => !found.some((one) => one.id === id))
  if (missing.length) {
    console.log(`${quiz.title}: немає персонажів ${missing.join(', ')} — пропускаю`)
    continue
  }
  const exists = await quizzes.findOne({ game: quiz.game, title: quiz.title })
  if (exists) {
    console.log(`${quiz.title}: уже є, пропускаю`)
    continue
  }
  if (dry) {
    console.log(`${quiz.title}: створив би (${quiz.questions.length} питань)`)
    continue
  }
  const now = new Date()
  await quizzes.insertOne({ ...quiz, cover: null, status: 'published', official: true, createdAt: now, updatedAt: now })
  console.log(`${quiz.title}: створено`)
}

await client.close()
