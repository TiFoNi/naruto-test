import raw from '../data/dota.json'
import atlas from '../data/dota-atlas.json'
import { compareLists, compareOrdered, exact, type Column, type Entity, type Game, type Icon } from './types'

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

const ATTRIBUTE_ICONS: Record<string, Omit<Icon, 'label'>> = {
  Сила: { symbol: '力', color: '#c0392b' },
  Ловкость: { symbol: '敏', color: '#27ae60' },
  Интеллект: { symbol: '知', color: '#2e86de' },
  Универсал: { symbol: '全', color: '#b48be0' },
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n)

const columns: Column<Hero>[] = [
  { title: 'Пол', render: (g, a) => ({ verdict: exact(g.gender, a.gender), text: g.gender }) },
  { title: 'Раса', render: (g, a) => ({ verdict: compareLists(g.species, a.species), text: g.species.join(', ') }) },
  { title: 'Роли', render: (g, a) => ({ verdict: compareLists(g.roles, a.roles), text: g.roles.join(', ') }) },
  {
    title: 'Атрибут',
    render: (g, a) => ({
      verdict: exact(g.attribute, a.attribute),
      text: g.attribute,
      icons: [{ label: g.attribute, ...ATTRIBUTE_ICONS[g.attribute] }],
    }),
  },
  { title: 'Тип атаки', render: (g, a) => ({ verdict: exact(g.attack, a.attack), text: g.attack }) },
  { title: 'Сложность', render: (g, a) => ({ ...compareOrdered(g.complexity, a.complexity), text: stars(g.complexity) }) },
  { title: 'Год выхода', render: (g, a) => ({ ...compareOrdered(g.year, a.year), text: String(g.year) }) },
]

export const dota: Game<Hero> = {
  id: 'dota',
  label: 'Dota 2',
  logo: ['DOTA', 'DLE'],
  entities: raw as Hero[],
  columns,
  searchTerms: (h) => [h.name, h.aliases],
  subtitle: () => undefined,
  atlas,
  atlasUrl: `${base}dota/thumbs.webp`,
  fullUrl: (h) => `${base}dota/full/${h.id}.webp`,
  placeholder: 'Введи героя (можно по-русски)…',
  classic: {
    title: 'Угадай героя из Dota 2',
    prompt: 'Введи любого героя — клетки подскажут, насколько ты близко.',
  },
  image: {
    label: 'Экран загрузки',
    title: 'Какой герой на этом арте?',
    prompt: 'С каждой неудачной попыткой арт немного отдаляется.',
    wide: true,
  },
  legend: { up: 'Больше / позже', down: 'Меньше / раньше' },
}
