import raw from '../data/ff.json'
import atlas from '../data/ff-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  generations: string[]
  affiliations: string[]
  rank: string
  side: string
  status: string
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Поколение', 'Поко­ління', 'Generation'), ...list('generations') },
  { title: l10n('Организация', 'Органі­зація', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Звание', 'Звання', 'Rank'), ...exact('rank') },
  { title: l10n('Сторона', 'Сторона', 'Side'), ...exact('side') },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (c, { tv }) => tv(c.arc) },
]

export const ff: Game<Character> = {
  id: 'ff',
  label: l10n('Пламенная бригада', 'Полум’яна бригада', 'Fire Force'),
  category: 'anime',
  description: l10n(
    'Спецпожарные роты, поколения пирокинетиков и Адолла — от вступления до Великого катаклизма.',
    'Спецпожежні роти, покоління пірокінетиків і Адолла — від вступу до Великого катаклізму.',
    'Special Fire Force companies, pyrokinetic generations and Adolla — from the start to the Great Cataclysm.',
  ),
  accent: '#ff6a2a',
  modes: ['classic', 'image'],
  featured: ['Shinra Kusakabe', 'Arthur Boyle', 'Benimaru Shinmon'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
