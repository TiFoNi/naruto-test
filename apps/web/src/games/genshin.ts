import atlas from '@nanda/game/data/genshin-atlas.json'
import { cells, l10n, type Column, type Entity, type Game, type Icon } from './types'

type Hero = Entity & {
  nameEn: string
  aliases: string
  gender: string
  element: string
  weapon: string
  region: string
  rarity: number
  year: number
}

const { exact } = cells<Hero>()

const ELEMENT_ICONS: Record<string, Omit<Icon, 'label'>> = {
  Анемо: { symbol: '風', color: '#74c2a8' },
  Гео: { symbol: '岩', color: '#d0a44c' },
  Электро: { symbol: '雷', color: '#a582c8' },
  Дендро: { symbol: '草', color: '#86b041' },
  Гидро: { symbol: '水', color: '#4cc2f1' },
  Пиро: { symbol: '火', color: '#ef7938' },
  Крио: { symbol: '氷', color: '#9fd6e3' },
}

const stars = (n: number) => '★'.repeat(n)

const columns: Column<Hero>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  {
    title: l10n('Стихия', 'Стихія', 'Element'),
    key: 'element',
    text: (g, { tv }) => tv(g.element),
    icons: (g, { tv }) => [{ label: tv(g.element), ...ELEMENT_ICONS[g.element] }],
  },
  { title: l10n('Оружие', 'Зброя', 'Weapon'), ...exact('weapon') },
  { title: l10n('Регион', 'Регіон', 'Region'), ...exact('region') },
  { title: l10n('Редкость', 'Рідкість', 'Rarity'), key: 'rarity', text: (g) => stars(g.rarity) },
  { title: l10n('Год выхода', 'Рік виходу', 'Release year'), key: 'year', text: (g) => String(g.year) },
]

export const genshin: Game<Hero> = {
  id: 'genshin',
  label: l10n('Геншин Импакт', 'Геншин Імпакт', 'Genshin Impact'),
  category: 'games',
  description: l10n(
    'Персонажи Genshin Impact: стихия, оружие, регион, редкость и год выхода. Можно искать по-русски — «ху тао», «райдэн».',
    'Персонажі Genshin Impact: стихія, зброя, регіон, рідкість і рік виходу. Можна шукати кирилицею — «ху тао», «райден».',
    'Genshin Impact characters: element, weapon, region, rarity and release year.',
  ),
  accent: '#4cc2f1',
  modes: ['classic', 'image', 'odd', 'pair'],
  featured: ['Hu Tao', 'Raiden Shogun', 'Zhongli', 'Klee'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'order',
}
