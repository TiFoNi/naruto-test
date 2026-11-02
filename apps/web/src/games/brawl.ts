import atlas from '@nanda/game/data/brawl-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Brawler = Entity & {
  nameEn: string
  gender: string
  kind: string
  rarity: string
  rarityIndex: number
  range: string
  rangeIndex: number
  speed: string
  speedIndex: number
  release: number
}

const { exact } = cells<Brawler>()

const columns: Column<Brawler>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Класс', 'Клас', 'Class'), ...exact('kind') },
  { title: l10n('Редкость', 'Рідкість', 'Rarity'), key: 'rarityIndex', text: (g, { tv }) => tv(g.rarity) },
  { title: l10n('Дальность', 'Дальність', 'Range'), key: 'rangeIndex', text: (g, { tv }) => tv(g.range) },
  { title: l10n('Скорость', 'Швидкість', 'Speed'), key: 'speedIndex', text: (g, { tv }) => tv(g.speed) },
  { title: l10n('Номер выхода', 'Номер виходу', 'Release no.'), key: 'release', text: (g) => `№${g.release}` },
]

export const brawl: Game<Brawler> = {
  id: 'brawl',
  label: l10n('Бравл Старс', 'Бравл Старс', 'Brawl Stars'),
  category: 'games',
  description: l10n(
    'Бравлеры Brawl Stars: класс, редкость, дальность, скорость и номер выхода. Можно искать и по-русски, и по-английски.',
    'Бравлери Brawl Stars: клас, рідкість, дальність, швидкість і номер виходу. Можна шукати й кирилицею, й англійською.',
    'Brawl Stars brawlers: class, rarity, range, speed and release number.',
  ),
  accent: '#ffc107',
  modes: ['classic', 'blind', 'image', 'odd', 'pair'],
  featured: ['Shelly', 'Colt', 'Spike', 'Leon'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'order',
}
