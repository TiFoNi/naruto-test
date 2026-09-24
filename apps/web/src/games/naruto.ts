import atlas from '@nanda/game/data/atlas.json'
import { cells, l10n, EMPTY, type Column, type Entity, type Game, type Icon } from './types'

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

const { list, exact } = cells<Character>()

const NATURE_ICONS: Record<string, Omit<Icon, 'label'>> = {
  Катон: { symbol: '火', color: '#e8542c' },
  Суйтон: { symbol: '水', color: '#2f7fd6' },
  Футон: { symbol: '風', color: '#3aa56b' },
  Дотон: { symbol: '土', color: '#9a6b3a' },
  Райтон: { symbol: '雷', color: '#d6b21f' },
  Инь: { symbol: '陰', color: '#3b2c5c' },
  Ян: { symbol: '陽', color: '#f2efe6', dark: true },
}

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Виды дзюцу', 'Види дзюцу', 'Jutsu types'), ...list('jutsuTypes') },
  { title: l10n('Кеккей генкай', 'Кеккей ґенкай', 'Kekkei genkai'), ...list('kekkeiGenkai') },
  {
    title: l10n('Природа чакры', 'Природа чакри', 'Nature type'),
    key: 'natureTypes',
    text: (g, { tv }) => g.natureTypes.map(tv).join(', ') || tv(EMPTY),
    icons: (g, { tv }) => g.natureTypes.map((n) => ({ label: tv(n), ...NATURE_ICONS[n] })),
  },
  { title: l10n('Атрибуты', 'Атрибути', 'Attributes'), ...list('attributes') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const naruto: Game<Character> = {
  id: 'naruto',
  label: l10n('Наруто', 'Наруто', 'Naruto'),
  category: 'anime',
  description: l10n(
    'Шиноби Конохи, Акацуки, каге и хвостатые — от Пролога до финала Четвёртой войны.',
    'Шинобі Конохи, Акацукі, каґе та хвостаті — від Прологу до фіналу Четвертої війни.',
    'Konoha shinobi, Akatsuki, Kage and tailed beasts — from the Prologue to the end of the Fourth War.',
  ),
  accent: '#ff8a1f',
  modes: ['classic', 'image'],
  featured: ['Naruto Uzumaki', 'Sasuke Uchiha', 'Kakashi Hatake', 'Itachi Uchiha'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
