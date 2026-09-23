import fs from 'fs'
const root = new URL('../src/data/', import.meta.url).pathname
const load = (f) => JSON.parse(fs.readFileSync(root + f + '.json', 'utf8'))
const has = (arr, v) => (arr ?? []).includes(v)
const any = (arr, list) => list.some((v) => has(arr, v))
const rules = {
  characters: [
    ['додзюцу-кеккей без Додзюцу', (c) => any(c.kekkeiGenkai, ['Шаринган', 'Бьякуган', 'Риннеган', 'Мангекьё Шаринган', 'Вечный Мангекьё Шаринган']) && !has(c.jutsuTypes, 'Додзюцу')],
    ['Додзюцу без додзюцу-кеккей', (c) => has(c.jutsuTypes, 'Додзюцу') && !any(c.kekkeiGenkai, ['Шаринган', 'Бьякуган', 'Риннеган', 'Мангекьё Шаринган', 'Вечный Мангекьё Шаринган'])],
    ['природа чакры без ниндзюцу', (c) => c.natureTypes.length && !has(c.jutsuTypes, 'Ниндзюцу')],
    ['Мокутон без Дотон/Суйтон', (c) => has(c.kekkeiGenkai, 'Мокутон') && c.natureTypes.length && !(has(c.natureTypes, 'Дотон') && has(c.natureTypes, 'Суйтон'))],
    ['Хвостатый зверь с полом М/Ж', (c) => has(c.attributes, 'Хвостатый зверь') && c.gender !== 'Другое'],
    ['Сенсор/Мудрец без ниндзюцу', (c) => has(c.attributes, 'Мудрец') && !has(c.jutsuTypes, 'Сендзюцу') && c.jutsuTypes.length > 0],
  ],
  aot: [
    ['оборотень без силы титана', (c) => has(c.species, 'Титан-оборотень') && !c.titans.length],
    ['сила титана без оборотня', (c) => c.titans.length && !has(c.species, 'Титан-оборотень')],
    ['Воин без Воинов Марли', (c) => has(c.occupations, 'Воин') && !has(c.affiliations, 'Воины Марли')],
    ['Воины Марли без титана и не кандидат', (c) => has(c.affiliations, 'Воины Марли') && !c.titans.length && !has(c.occupations, 'Воин')],
    ['Разведкорпус но не солдат', (c) => has(c.affiliations, 'Разведкорпус') && c.occupations.length && !has(c.occupations, 'Солдат') && !has(c.species, 'Лошадь')],
  ],
  bleach: [
    ['шикай/банкай без шинигами', (c) => any(c.powers, ['Шикай', 'Банкай']) && !any(c.races, ['Шинигами', 'Дух занпакто'])],
    ['ресуррексион без арранкара', (c) => has(c.powers, 'Ресуррексион') && !any(c.races, ['Арранкар', 'Шинигами'])],
    ['эспада/фрасьон без арранкара', (c) => any(c.ranks, ['Эспада', 'Фрасьон']) && !has(c.races, 'Арранкар')],
    ['эспада/фрасьон без Армии Айзена', (c) => any(c.ranks, ['Эспада', 'Фрасьон']) && !has(c.affiliations, 'Армия Айзена')],
    ['штернриттер без квинси', (c) => has(c.ranks, 'Штернриттер') && !has(c.races, 'Квинси')],
    ['штернриттер без Ванденрейха', (c) => has(c.ranks, 'Штернриттер') && !has(c.affiliations, 'Ванденрейх')],
    ['капитан/лейтенант без Готей 13', (c) => any(c.ranks, ['Капитан', 'Лейтенант']) && !has(c.affiliations, 'Готей 13') && !has(c.affiliations, 'Нулевой отряд')],
    ['отряд без Готей 13', (c) => c.division && !has(c.affiliations, 'Готей 13')],
    ['капитан/лейтенант без отряда', (c) => any(c.ranks, ['Капитан', 'Лейтенант']) && !c.division],
    ['Фулбринг без человека', (c) => has(c.powers, 'Фулбринг') && !has(c.races, 'Человек')],
    ['пустой-вайзард без шинигами', (c) => has(c.affiliations, 'Вайзарды') && !has(c.races, 'Шинигами')],
  ],
  tg: [
    ['кагуне у человека', (c) => c.kagune.length && c.species.length && c.species.every((s) => s === 'Человек')],
    ['рейтинг у человека', (c) => c.rating && c.species.length && c.species.every((s) => s === 'Человек')],
    ['квинкс без CCG', (c) => has(c.species, 'Квинкс') && !has(c.affiliations, 'CCG')],

  ],
  berserk: [
    ['Длань Господа не демон', (c) => has(c.affiliations, 'Длань Господа') && !any(c.kinds, ['Демон', 'Апостол', 'Сущность'])],
    ['человек и апостол/демон сразу', (c) => has(c.kinds, 'Человек') && any(c.kinds, ['Апостол', 'Демон', 'Псевдоапостол'])],
    ['нет вида', (c) => !c.kinds.length],
    ['нежить мёртв', (c) => has(c.kinds, 'Нежить') && c.status === 'Мёртв'],
  ],
  onepiece: [
    ['флот и пираты Соломенной шляпы', (c) => has(c.affiliations, 'Флот') && has(c.affiliations, 'Пираты Соломенной Шляпы')],
    ['правительство и революционеры', (c) => has(c.affiliations, 'Мировое правительство') && has(c.affiliations, 'Революционная армия')],
    ['королевская хаки без других', (c) => has(c.haki, 'Королевская') && c.haki.length === 1],
    ['логия и зоан сразу', (c) => has(c.fruits, 'Логия') && has(c.fruits, 'Зоан')],
    ['нет расы', (c) => !c.races.length],
  ],
  kny: [
    ['ранг корпуса без Корпуса', (c) => ['Столп', 'Цугуко', 'Истребитель', 'Какуши', 'Глава корпуса', 'Наставник'].includes(c.rank) && !has(c.affiliations, 'Корпус истребителей')],
    ['луна без Двенадцати лун', (c) => ['Высшая луна', 'Низшая луна'].includes(c.rank) && !has(c.affiliations, 'Двенадцать лун')],
    ['луна не демон', (c) => ['Высшая луна', 'Низшая луна', 'Прародитель демонов'].includes(c.rank) && c.species !== 'Демон'],
    ['кровавая техника у человека', (c) => has(c.styles, 'Кровавая техника') && c.species !== 'Демон'],
    ['демон с рангом корпуса', (c) => c.species === 'Демон' && ['Столп', 'Цугуко', 'Истребитель', 'Какуши'].includes(c.rank)],
  ],
  dn: [
    ['синигами без тетради', (c) => c.species === 'Синигами' && c.note !== 'Владел'],
    ['синигами без глаз', (c) => c.species === 'Синигами' && c.eyes !== 'Есть'],
    ['SPK и мафия сразу', (c) => has(c.orgs, 'SPK') && has(c.orgs, 'Мафия')],
    ['нет организации', (c) => !c.orgs.length],
  ],
  manga: [
    ['есть страницы, но не загадывается', (c) => c.pages > 0 && !c.answer],
    ['загадывается без страниц', (c) => c.answer && !c.pages],
  ],
  se: [
    ['мастер и оружие сразу', (c) => c.role === 'Мастер' && has(c.species, 'Демоническое оружие')],
    ['класс EAT без Шибусэна', (c) => has(c.affiliations, 'Класс EAT') && !has(c.affiliations, 'Шибусэн')],
    ['спартой без Шибусэна', (c) => has(c.affiliations, 'Спартой') && !has(c.affiliations, 'Шибусэн')],
    ['ведьма без вида ведьма', (c) => has(c.affiliations, 'Орден ведьм') && !any(c.species, ['Ведьма', 'Колдун'])],
    ['нет вида', (c) => !c.species.length],
    ['нет организации', (c) => !c.affiliations.length],
  ],
  ff: [
    ['капитан без роты', (c) => c.rank === 'Капитан' && !c.affiliations.some((a) => /рота/.test(a))],
    ['инферналец не первого поколения', (c) => has(c.generations, 'Первое') && c.generations.length > 1],
    ['без силы и с поколением', (c) => has(c.generations, 'Без силы') && c.generations.length > 1],
    ['нет поколения', (c) => !c.generations.length],
    ['нет организации', (c) => !c.affiliations.length],
  ],
  jojo: [
    ['люди из столбов не человек из столба', (c) => has(c.groups, 'Люди из столбов') && !has(c.species, 'Человек из столба')],
    ['хамон после 2-й части', (c) => has(c.powers, 'Хамон') && c.partIndex > 2 && !has(c.powers, 'Стенд')],
    ['спин не из Стального шара', (c) => has(c.powers, 'Спин') && c.partIndex !== 6],
    ['нет вида', (c) => !c.species.length],
    ['нет силы', (c) => !c.powers.length],
  ],
  hxh: [
    ['муравей без принадлежности к химерам', (c) => has(c.species, 'Муравей-химера') && !has(c.affiliations, 'Муравьи-химеры')],
    ['гвардия без химер', (c) => has(c.affiliations, 'Гвардия Короля') && !has(c.affiliations, 'Муравьи-химеры')],
    ['нет вида', (c) => !c.species.length],
  ],
  bc: [
    ['тёмная троица не из Пик', (c) => c.squad === 'Тёмная троица' && c.country !== 'Королевство Пик'],
    ['нет магии', (c) => !c.magic.length],
    ['отряд без Клевера', (c) => !['Нет отряда', 'Глаз полуночного солнца', 'Тёмная троица'].includes(c.squad) && c.country !== 'Королевство Клевера'],
  ],
  mk: [
    ['шокан по группе, но не по расе', (c) => has(c.affiliations, 'Шокан') && !has(c.species, 'Шокан')],
    ['таркатаны по группе, но не по расе', (c) => has(c.affiliations, 'Таркатаны') && !has(c.species, 'Таркатан')],
    ['семья Эдении не эденианец', (c) => has(c.affiliations, 'Королевская семья Эдении') && !has(c.species, 'Эденианец')],
    ['боги без расы бог', (c) => has(c.affiliations, 'Боги') && !has(c.species, 'Бог')],
    ['эденианец не из Эдении', (c) => c.species.length === 1 && has(c.species, 'Эденианец') && c.origin !== 'Эдения'],
    ['шокан/таркатан не из Внешнего мира', (c) => any(c.species, ['Шокан', 'Таркатан']) && c.origin !== 'Внешний мир'],
  ],
  dota: [
    ['нет расы', (c) => !c.species.length],
  ],
}
let problems = 0
for (const [file, list] of Object.entries(rules)) {
  const data = load(file)
  for (const [label, test] of list) {
    const hits = data.filter(test)
    if (!hits.length) continue
    problems += hits.length
    console.log(`${file}: ${label} (${hits.length}): ${hits.map((c) => c.nameEn ?? c.name).slice(0, 18).join(', ')}`)
  }
}
console.log(problems ? `\n${problems} inconsistencies` : 'data is consistent')
process.exitCode = problems ? 1 : 0
