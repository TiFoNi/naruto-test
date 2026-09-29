import atlas from '@nanda/game/data/marvel-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Hero = Entity & {
  nameEn: string
  gender: string
  species: string
  side: string
  teams: string[]
  powers: string[]
  debut: string
  debutIndex: number
}

const { list, exact } = cells<Hero>()

const columns: Column<Hero>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Вид', 'Вид', 'Species'), ...exact('species') },
  { title: l10n('Сторона', 'Сторона', 'Side') , ...exact('side') },
  { title: l10n('Команда', 'Команда', 'Team'), ...list('teams') },
  { title: l10n('Способности', 'Здібності', 'Powers'), ...list('powers') },
  { title: l10n('Первое появление', 'Перша поява', 'First appearance'), key: 'debutIndex', text: (hero) => hero.debut },
]

export const marvel: Game<Hero> = {
  id: 'marvel',
  label: l10n('Марвел', 'Марвел', 'Marvel'),
  category: 'screen',
  description: l10n(
    'Мстители, Люди Икс, Стражи Галактики и злодеи — герои комиксов и фильмов Marvel.',
    'Месники, Люди Ікс, Вартові Галактики та лиходії — герої коміксів і фільмів Marvel.',
    'Avengers, X-Men, Guardians of the Galaxy and villains — heroes of Marvel comics and films.',
  ),
  accent: '#e23636',
  modes: ['classic', 'image'],
  featured: ['Iron Man', 'Spider-Man', 'Thor'],
  unit: 'hero',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
