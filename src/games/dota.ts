import raw from '../data/dota.json'
import atlas from '../data/dota-atlas.json'
import { cells, l10n, type Column, type Entity, type Game, type Icon } from './types'

type Hero = Entity & {
  aliases: string
  gender: string
  species: string[]
  roles: string[]
  attribute: string
  attack: string
  complexity: number
  year: number
}

const { list, exact } = cells<Hero>()

const ATTRIBUTE_ICONS: Record<string, Omit<Icon, 'label'>> = {
  Сила: { symbol: '力', color: '#c0392b' },
  Ловкость: { symbol: '敏', color: '#27ae60' },
  Интеллект: { symbol: '知', color: '#2e86de' },
  Универсал: { symbol: '全', color: '#b48be0' },
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)

const columns: Column<Hero>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Раса', 'Раса', 'Species'), ...list('species') },
  { title: l10n('Роли', 'Ролі', 'Roles'), ...list('roles') },
  {
    title: l10n('Атрибут', 'Атрибут', 'Attribute'),
    key: 'attribute',
    text: (g, { tv }) => tv(g.attribute),
    icons: (g, { tv }) => [{ label: tv(g.attribute), ...ATTRIBUTE_ICONS[g.attribute] }],
  },
  { title: l10n('Тип атаки', 'Тип атаки', 'Attack type'), ...exact('attack') },
  { title: l10n('Сложность', 'Складність', 'Complexity'), key: 'complexity', text: (g) => stars(g.complexity) },
  { title: l10n('Год выхода', 'Рік виходу', 'Release year'), key: 'year', text: (g) => String(g.year) },
]

export const dota: Game<Hero> = {
  id: 'dota',
  label: l10n('Dota 2', 'Dota 2', 'Dota 2'),
  category: 'games',
  description: l10n(
    'Все герои Dota 2: атрибуты, роли, сложность и год выхода. Можно искать по-русски — «пудж», «инвокер».',
    'Усі герої Dota 2: атрибути, ролі, складність і рік виходу. Можна шукати кирилицею — «пудж», «інвокер».',
    'Every Dota 2 hero: attributes, roles, complexity and release year.',
  ),
  accent: '#e5483b',
  modes: ['classic', 'image', 'ability'],
  featured: ['Pudge', 'Invoker', 'Crystal Maiden', 'Juggernaut'],
  unit: 'hero',
  entities: raw as Hero[],
  columns,
  atlas,
  wideImages: true,
  legend: 'order',
}
