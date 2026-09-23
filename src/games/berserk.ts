import raw from '../data/berserk.json'
import atlas from '../data/berserk-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  kinds: string[]
  affiliations: string[]
  occupations: string[]
  status: string
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Вид', 'Вид', 'Kind'), ...list('kinds') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Род занятий', 'Рід занять', 'Occupation'), ...list('occupations') },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const berserk: Game<Character> = {
  id: 'berserk',
  label: l10n('Берсерк', 'Берсерк', 'Berserk'),
  category: 'anime',
  description: l10n(
    'Отряд Ястреба, апостолы и Длань Господа — от Чёрного мечника до Фантазии.',
    'Загін Яструба, апостоли й Длань Господа — від Чорного мечника до Фантазії.',
    'The Band of the Falcon, Apostles and the God Hand — from the Black Swordsman to Fantasia.',
  ),
  accent: '#a9b4c2',
  modes: ['classic', 'image'],
  featured: ['Guts', 'Griffith', 'Casca'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
