import raw from '../data/bluelock.json'
import atlas from '../data/bluelock-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  role: string
  positions: string[]
  country: string
  club: string
  arc: string
  arcIndex: number
}

const base = import.meta.env.BASE_URL
const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Роль', 'Роль', 'Role'), ...exact('role') },
  { title: l10n('Позиция', 'Позиція', 'Position'), ...list('positions') },
  { title: l10n('Страна', 'Країна', 'Country'), ...exact('country') },
  { title: l10n('Клуб в NEL', 'Клуб у NEL', 'NEL club'), ...exact('club') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const bluelock: Game<Character> = {
  id: 'bluelock',
  label: l10n('Блю Лок', 'Блю Лок', 'Blue Lock'),
  category: 'anime',
  description: l10n(
    'Эгоисты Блю Лока, клубы Лиги Нео Эгоистов и звёзды мирового футбола.',
    'Егоїсти Блю Лока, клуби Ліги Нео Егоїстів і зірки світового футболу.',
    'Blue Lock egoists, Neo Egoist League clubs and world football stars.',
  ),
  accent: '#3d7bff',
  modes: ['classic', 'image'],
  featured: ['Yoichi Isagi', 'Meguru Bachira', 'Rin Itoshi'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  atlasUrl: `${base}bluelock/thumbs.webp`,
  fullUrl: (c) => `${base}bluelock/full/${c.id}.webp`,
  wideImages: false,
  legend: 'debut',
}
