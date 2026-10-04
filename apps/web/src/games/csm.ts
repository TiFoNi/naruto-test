import atlas from '@nanda/game/data/csm-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string
  role: string
  affiliations: string[]
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Природа', 'Природа', 'Nature'), ...exact('species') },
  { title: l10n('Занятие', 'Заняття', 'Occupation'), ...exact('role') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const csm: Game<Character> = {
  id: 'csm',
  label: l10n('Человек-бензопила', 'Людина-бензопила', 'Chainsaw Man'),
  category: 'anime',
  description: l10n(
    'Дьяволы, исчадия и охотники — от Почиты до Четырёх всадников.',
    'Дияволи, поріддя й охотники — від Почіти до Чотирьох вершників.',
    'Devils, fiends and hunters — from Pochita to the Four Horsemen.',
  ),
  accent: '#ef7623',
  modes: ['classic', 'image', 'odd'],
  featured: ['Denji', 'Power', 'Makima'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
