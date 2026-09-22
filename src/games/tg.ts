import raw from '../data/tg.json'
import atlas from '../data/tg-atlas.json'
import { cells, compareOrdered, l10n, EMPTY, type Cell, type Column, type Entity, type Game, type RenderContext } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string[]
  affiliations: string[]
  kagune: string[]
  rating: string | null
  ratingIndex: number
  status: string
  series: 'tg' | 're'
  volume: number
  debutIndex: number
}

const base = import.meta.env.BASE_URL
const { list, exact } = cells<Character>()

const VOLUME = l10n('том {v}', 'том {v}', 'vol. {v}')
const ONESHOT = l10n('ваншот', 'ваншот', 'oneshot')

function rating(g: Character, a: Character, { tv }: RenderContext): Cell {
  const text = g.rating ?? tv(EMPTY)
  if (g.ratingIndex >= 0 && a.ratingIndex >= 0) return { ...compareOrdered(g.ratingIndex, a.ratingIndex), text }
  return { verdict: g.ratingIndex === a.ratingIndex ? 'correct' : 'wrong', text }
}

function debut(g: Character, a: Character, { lang }: RenderContext): Cell {
  const series = g.series === 're' ? ':re' : 'TG'
  const part = g.volume === 0 ? ONESHOT[lang] : VOLUME[lang].replace('{v}', String(g.volume))
  return { ...compareOrdered(g.debutIndex, a.debutIndex), text: `${series} · ${part}` }
}

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), render: exact('gender') },
  { title: l10n('Вид', 'Вид', 'Species'), render: list('species') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), render: list('affiliations') },
  { title: l10n('Кагуне', 'Кагуне', 'Kagune'), render: list('kagune') },
  { title: l10n('Рейтинг', 'Рейтинг', 'Rating'), render: rating },
  { title: l10n('Статус', 'Статус', 'Status'), render: exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), render: debut },
]

export const tg: Game<Character> = {
  id: 'tg',
  label: l10n('Токийский гуль', 'Токійський гуль', 'Tokyo Ghoul'),
  category: 'anime',
  description: l10n(
    'Гули, следователи CCG, Аогири и квинксы — от «Антейку» до финала :re.',
    'Гулі, слідчі CCG, Аоґірі та квінкси — від «Антейку» до фіналу :re.',
    'Ghouls, CCG investigators, Aogiri and the Quinx — from Anteiku to the end of :re.',
  ),
  accent: '#e0457b',
  modes: ['classic', 'image'],
  featured: ['Ken Kaneki', 'Touka Kirishima', 'Kishou Arima'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  atlasUrl: `${base}tg/thumbs.webp`,
  fullUrl: (c) => `${base}tg/full/${c.id}.webp`,
  wideImages: false,
  legend: 'order',
}
