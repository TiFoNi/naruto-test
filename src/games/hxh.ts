import raw from '../data/hxh.json'
import atlas from '../data/hxh-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string[]
  nen: string
  affiliations: string[]
  status: string
  arc: string
  arcIndex: number
}

const base = import.meta.env.BASE_URL
const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Вид', 'Вид', 'Species'), ...list('species') },
  { title: l10n('Тип нэн', 'Тип нен', 'Nen type'), ...exact('nen') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const hxh: Game<Character> = {
  id: 'hxh',
  label: l10n('Хантер × Хантер', 'Хантер × Хантер', 'Hunter × Hunter'),
  category: 'anime',
  description: l10n(
    'Охотники, Труппа Призраков и муравьи-химеры — от экзамена на охотника до Тёмного континента.',
    'Мисливці, Трупа Привидів і мурахи-химери — від іспиту на мисливця до Темного континенту.',
    'Hunters, the Phantom Troupe and Chimera Ants — from the Hunter Exam to the Dark Continent.',
  ),
  accent: '#3fbf8f',
  modes: ['classic', 'image'],
  featured: ['Gon Freecss', 'Killua Zoldyck', 'Kurapika'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  atlasUrl: `${base}hxh/thumbs.webp`,
  fullUrl: (c) => `${base}hxh/full/${c.id}.webp`,
  wideImages: false,
  legend: 'debut',
}
