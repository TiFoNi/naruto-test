import raw from '../data/dota.json'
import atlas from '../data/dota-atlas.json'
import { cells, compareOrdered, exact as same, l10n, type Column, type Entity, type Game, type Icon } from './types'

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

const base = import.meta.env.BASE_URL
const { list, exact } = cells<Hero>()

const ATTRIBUTE_ICONS: Record<string, Omit<Icon, 'label'>> = {
  Сила: { symbol: '力', color: '#c0392b' },
  Ловкость: { symbol: '敏', color: '#27ae60' },
  Интеллект: { symbol: '知', color: '#2e86de' },
  Универсал: { symbol: '全', color: '#b48be0' },
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)

const columns: Column<Hero>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), render: exact('gender') },
  { title: l10n('Раса', 'Раса', 'Species'), render: list('species') },
  { title: l10n('Роли', 'Ролі', 'Roles'), render: list('roles') },
  {
    title: l10n('Атрибут', 'Атрибут', 'Attribute'),
    render: (g, a, { tv }) => ({
      verdict: same(g.attribute, a.attribute),
      text: tv(g.attribute),
      icons: [{ label: tv(g.attribute), ...ATTRIBUTE_ICONS[g.attribute] }],
    }),
  },
  { title: l10n('Тип атаки', 'Тип атаки', 'Attack type'), render: exact('attack') },
  { title: l10n('Сложность', 'Складність', 'Complexity'), render: (g, a) => ({ ...compareOrdered(g.complexity, a.complexity), text: stars(g.complexity) }) },
  { title: l10n('Год выхода', 'Рік виходу', 'Release year'), render: (g, a) => ({ ...compareOrdered(g.year, a.year), text: String(g.year) }) },
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
  modes: ['classic', 'image'],
  featured: ['Pudge', 'Invoker', 'Crystal Maiden', 'Juggernaut'],
  unit: 'hero',
  entities: raw as Hero[],
  columns,
  atlas,
  atlasUrl: `${base}dota/thumbs.webp`,
  fullUrl: (h) => `${base}dota/full/${h.id}.webp`,
  wideImages: true,
  legend: 'order',
}
