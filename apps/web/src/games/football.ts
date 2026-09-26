import atlas from '@nanda/game/data/football-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Player = Entity & {
  nameEn: string
  country: string
  part: string
  roles: string[]
  club: string
  status: string
  height: number
  birth: number
}

const { list, exact } = cells<Player>()

const columns: Column<Player>[] = [
  { title: l10n('Страна', 'Країна', 'Country'), ...exact('country') },
  { title: l10n('Часть света', 'Частина світу', 'Region'), ...exact('part') },
  { title: l10n('Позиция', 'Позиція', 'Position'), ...list('roles') },
  { title: l10n('Клуб', 'Клуб', 'Club'), ...exact('club') },
  { title: l10n('Карьера', 'Кар’єра', 'Career'), ...exact('status') },
  { title: l10n('Рост', 'Зріст', 'Height'), key: 'height', text: (g) => `${g.height} см` },
  { title: l10n('Год рождения', 'Рік народження', 'Born'), key: 'birth', text: (g) => String(g.birth) },
]

export const football: Game<Player> = {
  id: 'football',
  label: l10n('Футболисты', 'Футболісти', 'Footballers'),
  category: 'sport',
  description: l10n(
    'Самые узнаваемые футболисты мира — от Пеле и Яшина до Месси, Мбаппе и Ямаля.',
    'Найвпізнаваніші футболісти світу — від Пеле і Яшина до Мессі, Мбаппе та Ямаля.',
    'The most recognisable footballers in the world — from Pelé and Yashin to Messi, Mbappé and Yamal.',
  ),
  accent: '#3fbf6f',
  modes: ['classic'],
  featured: ['Lionel Messi', 'Cristiano Ronaldo', 'Pelé'],
  unit: 'player',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'order',
}
