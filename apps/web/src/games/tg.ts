import raw from '@nanda/game/data/tg.json'
import atlas from '@nanda/game/data/tg-atlas.json'
import { cells, l10n, EMPTY, type Column, type Entity, type Game } from './types'

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

const { list, exact } = cells<Character>()

const VOLUME = l10n('том {v}', 'том {v}', 'vol. {v}')
const ONESHOT = l10n('ваншот', 'ваншот', 'oneshot')

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Вид', 'Вид', 'Species'), ...list('species') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Кагуне', 'Кагуне', 'Kagune'), ...list('kagune') },
  { title: l10n('Рейтинг', 'Рейтинг', 'Rating'), key: 'ratingIndex', text: (g, { tv }) => g.rating ?? tv(EMPTY) },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  {
    title: l10n('Дебют', 'Дебют', 'Debut'),
    key: 'debutIndex',
    text: (g, { lang }) => `${g.series === 're' ? ':re' : 'TG'} · ${g.volume === 0 ? ONESHOT[lang] : VOLUME[lang].replace('{v}', String(g.volume))}`,
  },
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
  wideImages: false,
  legend: 'order',
}
