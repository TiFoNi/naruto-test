import raw from '../data/bleach.json'
import atlas from '../data/bleach-atlas.json'
import { compareLists, compareOrdered, exact, type Cell, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  races: string[]
  affiliations: string[]
  ranks: string[]
  powers: string[]
  division: number | null
  arc: string
  arcIndex: number
}

const EMPTY = 'Нет'
const base = import.meta.env.BASE_URL

const list = (key: 'races' | 'affiliations' | 'ranks' | 'powers') => (g: Character, a: Character) => ({
  verdict: compareLists(g[key], a[key]),
  text: g[key].join(', ') || EMPTY,
})

function division(g: Character, a: Character): Cell {
  const text = g.division ? `${g.division}-й отряд` : EMPTY
  if (g.division && a.division) return { ...compareOrdered(g.division, a.division), text }
  return { verdict: g.division === a.division ? 'correct' : 'wrong', text }
}

const columns: Column<Character>[] = [
  { title: 'Пол', render: (g, a) => ({ verdict: exact(g.gender, a.gender), text: g.gender }) },
  { title: 'Раса', render: list('races') },
  { title: 'Принадлеж­ность', render: list('affiliations') },
  { title: 'Должность', render: list('ranks') },
  { title: 'Отряд', render: division },
  { title: 'Силы', render: list('powers') },
  { title: 'Дебют', render: (g, a) => ({ ...compareOrdered(g.arcIndex, a.arcIndex), text: g.arc }) },
]

export const bleach: Game<Character> = {
  id: 'bleach',
  label: 'Блич',
  logo: ['BLEACH', 'DLE'],
  entities: raw as Character[],
  columns,
  searchTerms: (c) => [c.name, c.nameEn],
  subtitle: (c) => c.nameEn,
  atlas,
  atlasUrl: `${base}bleach/thumbs.webp`,
  fullUrl: (c) => `${base}bleach/full/${c.id}.webp`,
  placeholder: 'Введи имя персонажа…',
  classic: {
    title: 'Угадай персонажа из «Блича»',
    prompt: 'Введи любого персонажа — клетки подскажут, насколько ты близко.',
  },
  image: {
    label: 'Картинка',
    title: 'Кто на картинке?',
    prompt: 'С каждой неудачной попыткой картинка немного отдаляется.',
    wide: false,
  },
  legend: { up: 'Позже / больше', down: 'Раньше / меньше' },
}
