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
  bluelock: [
    ['позиция у не-игрока', (c) => c.positions.length && !['Игрок Блю Лока', 'Футболист'].includes(c.role)],
    ['клуб NEL у не-игрока', (c) => c.club !== 'Не в NEL' && !['Игрок Блю Лока', 'Футболист'].includes(c.role)],
    ['игрок Блю Лока не из Японии', (c) => c.role === 'Игрок Блю Лока' && c.country !== 'Япония'],
    ['игрок без позиции', (c) => c.answer && ['Игрок Блю Лока', 'Футболист'].includes(c.role) && !c.positions.length],
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
