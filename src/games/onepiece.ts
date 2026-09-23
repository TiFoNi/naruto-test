import raw from '../data/onepiece.json'
import atlas from '../data/onepiece-atlas.json'
import { EMPTY, cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  races: string[]
  affiliations: string[]
  fruits: string[]
  haki: string[]
  bounty: number
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const NO_BOUNTY = l10n('Нет награды', 'Без нагороди', 'No bounty')
const MILLION = l10n('{v} млн', '{v} млн', '{v}M')
const BILLION = l10n('{v} млрд', '{v} млрд', '{v}B')

function formatBounty(value: number, lang: 'ru' | 'uk' | 'en') {
  if (value <= 0) return NO_BOUNTY[lang]
  if (value >= 1e9) return BILLION[lang].replace('{v}', String(+(value / 1e9).toFixed(2)))
  if (value >= 1e6) return MILLION[lang].replace('{v}', String(+(value / 1e6).toFixed(1)))
  return `${value.toLocaleString(lang)} ฿`
}

const listOr = (key: 'fruits' | 'haki') => ({
  key,
  text: (g: Character, { tv }: { tv: (v: string) => string }) => g[key].map(tv).join(', ') || tv(EMPTY),
})

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Раса', 'Раса', 'Race'), ...list('races') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Дьявольский плод', 'Диявольський плід', 'Devil Fruit'), ...listOr('fruits') },
  { title: l10n('Хаки', 'Хакі', 'Haki'), ...listOr('haki') },
  { title: l10n('Награда', 'Нагорода', 'Bounty'), key: 'bounty', text: (g, { lang }) => formatBounty(g.bounty, lang) },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const onepiece: Game<Character> = {
  id: 'onepiece',
  label: l10n('Ван Пис', 'Ван Піс', 'One Piece'),
  category: 'anime',
  description: l10n(
    'Пираты Соломенной Шляпы, Йонко, адмиралы и Мировое правительство — от Ромэнс Дона до Эльбафа.',
    'Пірати Солом’яного Капелюха, Йонко, адмірали й Світовий уряд — від Роменс Дону до Ельбафу.',
    'The Straw Hats, the Emperors, the Admirals and the World Government — from Romance Dawn to Elbaph.',
  ),
  accent: '#f0a830',
  modes: ['classic', 'image'],
  featured: ['Monkey D. Luffy', 'Roronoa Zoro', 'Sanji'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  wideImages: false,
  legend: 'order',
}
