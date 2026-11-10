import atlas from '@nanda/game/data/kuroko-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  teams: string[]
  position: string[]
  height: number
  group: string
  episode: number
}

const { list, exact } = cells<Character>()

const EPISODE = { ru: 'Серия', uk: 'Серія', en: 'Ep.' } as const
const CM = { ru: 'см', uk: 'см', en: 'cm' } as const

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Команда', 'Команда', 'Team'), ...list('teams') },
  { title: l10n('Позиция', 'Позиція', 'Position'), ...list('position') },
  { title: l10n('Рост', 'Зріст', 'Height'), key: 'height', text: (g, { lang }) => `${g.height} ${CM[lang]}` },
  { title: l10n('Группа', 'Група', 'Group'), ...exact('group') },
  { title: l10n('Дебют в аниме', 'Дебют в аніме', 'Anime debut'), key: 'episode', text: (g, { lang }) => `${EPISODE[lang]} ${g.episode}` },
]

export const kuroko: Game<Character> = {
  id: 'kuroko',
  label: l10n('Баскетбол Куроко', 'Баскетбол Куроко', "Kuroko's Basketball"),
  category: 'anime',
  description: l10n(
    'Сейрин, Поколение чудес и их соперники из трёх сезонов аниме.',
    'Сейрін, Покоління чудес і їхні суперники з трьох сезонів аніме.',
    'Seirin, the Generation of Miracles and their rivals from the three anime seasons.',
  ),
  accent: '#e8682a',
  modes: ['classic', 'blind', 'image', 'odd', 'pair'],
  featured: ['Tetsuya Kuroko', 'Taiga Kagami', 'Daiki Aomine', 'Seijūrō Akashi'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'order',
}
