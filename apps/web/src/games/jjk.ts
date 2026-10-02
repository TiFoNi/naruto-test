import atlas from '@nanda/game/data/jjk-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string
  grade: string
  roles: string[]
  affiliations: string[]
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Природа', 'Природа', 'Nature'), ...exact('species') },
  { title: l10n('Ранг', 'Ранг', 'Grade'), ...exact('grade') },
  { title: l10n('Роль', 'Роль', 'Role'), ...list('roles') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const jjk: Game<Character> = {
  id: 'jjk',
  label: l10n('Магическая битва', 'Магічна битва', 'Jujutsu Kaisen'),
  category: 'anime',
  description: l10n(
    'Маги, проклятия и ранги — от проклятой утробы до битвы в Синдзюку.',
    'Маги, прокляття й ранги — від проклятої утроби до битви в Сіндзюку.',
    'Sorcerers, curses and grades — from the cursed womb to the Shinjuku showdown.',
  ),
  accent: '#4a66e0',
  modes: ['classic', 'image'],
  featured: ['Yuji Itadori', 'Satoru Gojo', 'Megumi Fushiguro'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
