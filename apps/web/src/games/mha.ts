import atlas from '@nanda/game/data/mha-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  quirkType: string
  side: string
  affiliations: string[]
  height: number
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Тип причуды', 'Тип примхи', 'Quirk type'), ...exact('quirkType') },
  { title: l10n('Сторона', 'Сторона', 'Side'), ...exact('side') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Рост', 'Зріст', 'Height'), key: 'height', text: (g) => `${g.height} см` },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const mha: Game<Character> = {
  id: 'mha',
  label: l10n('Моя геройская академия', 'Моя геройська академія', 'My Hero Academia'),
  category: 'anime',
  description: l10n(
    'Ученики Ю-Эй, профи-герои и злодеи: тип причуды, сторона, фракция, рост и арка дебюта.',
    'Учні Ю-Ей, профі-герої та лиходії: тип примхи, сторона, фракція, зріст і арка дебюту.',
    'U.A. students, pro heroes and villains: quirk type, side, faction, height and debut arc.',
  ),
  accent: '#3fa14b',
  modes: ['classic', 'image', 'odd', 'pair'],
  featured: ['Izuku Midoriya', 'Katsuki Bakugo', 'Shoto Todoroki', 'Toshinori Yagi'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
