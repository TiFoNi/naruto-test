import atlas from '@nanda/game/data/got-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  aliases: string
  gender: string
  houses: string[]
  cultures: string[]
  orgs: string[]
  status: string
  season: number
}

const { list, exact } = cells<Character>()

const SEASON = { ru: 'Сезон', uk: 'Сезон', en: 'Season' } as const

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Дом', 'Дім', 'House'), ...list('houses') },
  { title: l10n('Культура', 'Культура', 'Culture'), ...list('cultures') },
  { title: l10n('Организация', 'Організація', 'Organization'), ...list('orgs') },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'season', text: (g, { lang }) => `${SEASON[lang]} ${g.season}` },
]

export const got: Game<Character> = {
  id: 'got',
  label: l10n('Игра престолов', 'Гра престолів', 'Game of Thrones'),
  category: 'screen',
  description: l10n(
    'Персонажи сериала «Игра престолов»: дом, культура, организация, статус и сезон дебюта.',
    'Персонажі серіалу «Гра престолів»: дім, культура, організація, статус і сезон дебюту.',
    'Game of Thrones characters: house, culture, organization, status and debut season.',
  ),
  accent: '#c8a24a',
  modes: ['classic', 'blind', 'image', 'odd', 'pair'],
  featured: ['Jon Snow', 'Daenerys Targaryen', 'Tyrion Lannister', 'Arya Stark'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'order',
}
