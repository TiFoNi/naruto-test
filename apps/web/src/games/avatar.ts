import atlas from '@nanda/game/data/avatar-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  nation: string
  bending: string[]
  skills: string[]
  groups: string[]
  status: string
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Народ', 'Народ', 'Nation'), ...exact('nation') },
  { title: l10n('Магия', 'Магія', 'Bending'), ...list('bending') },
  { title: l10n('Техники', 'Техніки', 'Techniques'), ...list('skills') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('groups') },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const avatar: Game<Character> = {
  id: 'avatar',
  label: l10n('Аватар', 'Аватар', 'Avatar'),
  category: 'anime',
  description: l10n(
    'Маги четырёх стихий: от Аанга и команды Аватара до Корры, Амона и Красного Лотоса.',
    'Маги чотирьох стихій: від Аанга й команди Аватара до Корри, Амона й Червоного Лотоса.',
    'Benders of the four elements: from Aang and Team Avatar to Korra, Amon and the Red Lotus.',
  ),
  accent: '#4fa3d1',
  modes: ['classic', 'image'],
  featured: ['Aang', 'Zuko', 'Korra'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
