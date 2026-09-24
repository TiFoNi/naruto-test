import atlas from '@nanda/game/data/jojo-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string[]
  powers: string[]
  groups: string[]
  side: string
  nation: string
  part: string
  partIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Вид', 'Вид', 'Species'), ...list('species') },
  { title: l10n('Сила', 'Сила', 'Power'), ...list('powers') },
  { title: l10n('Группа', 'Група', 'Group'), ...list('groups') },
  { title: l10n('Сторона', 'Сторона', 'Side'), ...exact('side') },
  { title: l10n('Откуда', 'Звідки', 'From'), ...exact('nation') },
  { title: l10n('Часть', 'Частина', 'Part'), key: 'partIndex', text: (g, { tv }) => tv(g.part) },
]

export const jojo: Game<Character> = {
  id: 'jojo',
  label: l10n('ДжоДжо', 'ДжоДжо', 'JoJo'),
  category: 'anime',
  description: l10n(
    'Джостары, стенды и хамон — части с 1-й по 7-ю, от Призрачной крови до Стального шара.',
    'Джостари, стенди й хамон — частини з 1-ї по 7-му, від Примарної крові до Сталевої кулі.',
    'The Joestars, Stands and Hamon — parts 1 to 7, from Phantom Blood to Steel Ball Run.',
  ),
  accent: '#c07de0',
  modes: ['classic', 'image'],
  featured: ['Jotaro Kujo', 'Dio Brando', 'Joseph Joestar'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
