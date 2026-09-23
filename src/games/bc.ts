import raw from '../data/bc.json'
import atlas from '../data/bc-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string
  magic: string[]
  squad: string
  country: string
  status: string
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Раса', 'Раса', 'Race'), ...exact('species') },
  { title: l10n('Магия', 'Магія', 'Magic'), ...list('magic') },
  { title: l10n('Орден', 'Орден', 'Squad'), ...exact('squad') },
  { title: l10n('Королевство', 'Королівство', 'Kingdom'), ...exact('country') },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const bc: Game<Character> = {
  id: 'bc',
  label: l10n('Чёрный клевер', 'Чорна конюшина', 'Black Clover'),
  category: 'anime',
  description: l10n(
    'Магические рыцари Клевера, эльфы и дьяволы — от вступления в отряды до Королевства Пик.',
    'Магічні лицарі Конюшини, ельфи й дияволи — від вступу до загонів до Королівства Пік.',
    'The Clover Kingdom Magic Knights, elves and devils — from squad tryouts to the Spade Kingdom.',
  ),
  accent: '#6ec06e',
  modes: ['classic', 'image'],
  featured: ['Asta', 'Yuno Grinberryall', 'Noelle Silva'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
