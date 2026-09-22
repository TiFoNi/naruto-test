import raw from '../data/kny.json'
import atlas from '../data/kny-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string
  affiliations: string[]
  rank: string
  styles: string[]
  status: string
  arc: string
  arcIndex: number
}

const base = import.meta.env.BASE_URL
const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Раса', 'Раса', 'Race'), ...exact('species') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Ранг', 'Ранг', 'Rank'), ...exact('rank') },
  { title: l10n('Стиль боя', 'Стиль бою', 'Fighting style'), ...list('styles') },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const kny: Game<Character> = {
  id: 'kny',
  label: l10n('Клинок, рассекающий демонов', 'Клинок, що розсікає демонів', 'Demon Slayer'),
  category: 'anime',
  description: l10n(
    'Истребители демонов, столпы и Двенадцать лун — от Финального отбора до последнего рассвета.',
    'Винищувачі демонів, стовпи й Дванадцять місяців — від Фінального відбору до останнього світанку.',
    'Demon Slayers, Hashira and the Twelve Kizuki — from Final Selection to the last sunrise.',
  ),
  accent: '#e0556b',
  modes: ['classic', 'image'],
  featured: ['Tanjiro Kamado', 'Nezuko Kamado', 'Zenitsu Agatsuma'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  atlasUrl: `${base}kny/thumbs.webp`,
  fullUrl: (c) => `${base}kny/full/${c.id}.webp`,
  wideImages: false,
  legend: 'debut',
}
