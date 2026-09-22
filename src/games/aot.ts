import raw from '../data/aot.json'
import atlas from '../data/aot-atlas.json'
import { compareLists, compareOrdered, exact, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string[]
  affiliations: string[]
  occupations: string[]
  titans: string[]
  status: string
  arc: string
  arcIndex: number
}

const EMPTY = 'Нет'
const base = import.meta.env.BASE_URL

const list = (key: 'species' | 'affiliations' | 'occupations' | 'titans') => (g: Character, a: Character) => ({
  verdict: compareLists(g[key], a[key]),
  text: g[key].join(', ') || EMPTY,
})

const columns: Column<Character>[] = [
  { title: 'Пол', render: (g, a) => ({ verdict: exact(g.gender, a.gender), text: g.gender }) },
  { title: 'Вид', render: list('species') },
  { title: 'Принадлеж­ность', render: list('affiliations') },
  { title: 'Род занятий', render: list('occupations') },
  { title: 'Сила титана', render: list('titans') },
  { title: 'Статус', render: (g, a) => ({ verdict: exact(g.status, a.status), text: g.status }) },
  { title: 'Дебют', render: (g, a) => ({ ...compareOrdered(g.arcIndex, a.arcIndex), text: g.arc }) },
]

export const aot: Game<Character> = {
  id: 'aot',
  label: 'Атака титанов',
  logo: ['TITAN', 'DLE'],
  entities: raw as Character[],
  columns,
  searchTerms: (c) => [c.name, c.nameEn],
  subtitle: (c) => c.nameEn,
  atlas,
  atlasUrl: `${base}aot/thumbs.webp`,
  fullUrl: (c) => `${base}aot/full/${c.id}.webp`,
  placeholder: 'Введи имя персонажа…',
  classic: {
    title: 'Угадай персонажа из «Атаки титанов»',
    prompt: 'Введи любого персонажа — клетки подскажут, насколько ты близко.',
  },
  image: {
    label: 'Картинка',
    title: 'Кто на картинке?',
    prompt: 'С каждой неудачной попыткой картинка немного отдаляется.',
    wide: false,
  },
  legend: { up: 'Дебют позже', down: 'Дебют раньше' },
}
