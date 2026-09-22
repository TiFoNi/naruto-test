import raw from '../data/characters.json'
import atlas from '../data/atlas.json'
import { compareLists, compareOrdered, exact, type Column, type Entity, type Game, type Icon } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  affiliations: string[]
  jutsuTypes: string[]
  kekkeiGenkai: string[]
  natureTypes: string[]
  attributes: string[]
  debutChapter: number
  arc: string
  arcIndex: number
}

const EMPTY = 'Нет'
const base = import.meta.env.BASE_URL

const NATURE_ICONS: Record<string, Omit<Icon, 'label'>> = {
  Катон: { symbol: '火', color: '#e8542c' },
  Суйтон: { symbol: '水', color: '#2f7fd6' },
  Футон: { symbol: '風', color: '#3aa56b' },
  Дотон: { symbol: '土', color: '#9a6b3a' },
  Райтон: { symbol: '雷', color: '#d6b21f' },
  Инь: { symbol: '陰', color: '#3b2c5c' },
  Ян: { symbol: '陽', color: '#f2efe6', dark: true },
}

const list = (key: 'affiliations' | 'jutsuTypes' | 'kekkeiGenkai' | 'attributes') => (g: Character, a: Character) => ({
  verdict: compareLists(g[key], a[key]),
  text: g[key].join(', ') || EMPTY,
})

const columns: Column<Character>[] = [
  { title: 'Пол', render: (g, a) => ({ verdict: exact(g.gender, a.gender), text: g.gender }) },
  { title: 'Принадлеж­ность', render: list('affiliations') },
  { title: 'Виды дзюцу', render: list('jutsuTypes') },
  { title: 'Кеккей генкай', render: list('kekkeiGenkai') },
  {
    title: 'Природа чакры',
    render: (g, a) => ({
      verdict: compareLists(g.natureTypes, a.natureTypes),
      text: g.natureTypes.join(', ') || EMPTY,
      icons: g.natureTypes.map((n) => ({ label: n, ...NATURE_ICONS[n] })),
    }),
  },
  { title: 'Атрибуты', render: list('attributes') },
  { title: 'Дебют', render: (g, a) => ({ ...compareOrdered(g.arcIndex, a.arcIndex), text: g.arc }) },
]

export const naruto: Game<Character> = {
  id: 'naruto',
  label: 'Наруто',
  logo: ['NARUTO', 'DLE'],
  entities: raw as Character[],
  columns,
  searchTerms: (c) => [c.name, c.nameEn],
  subtitle: (c) => c.nameEn,
  atlas,
  atlasUrl: `${base}characters/thumbs.webp`,
  fullUrl: (c) => `${base}characters/full/${c.id}.webp`,
  placeholder: 'Введи имя персонажа…',
  classic: {
    title: 'Угадай персонажа из «Наруто»',
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
