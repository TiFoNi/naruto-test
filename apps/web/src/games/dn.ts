import raw from '@nanda/game/data/dn.json'
import atlas from '@nanda/game/data/dn-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string
  orgs: string[]
  note: string
  eyes: string
  status: string
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Вид', 'Вид', 'Species'), ...exact('species') },
  { title: l10n('Организация', 'Органі­зація', 'Affiliation'), ...list('orgs') },
  { title: l10n('Тетрадь', 'Зошит', 'Death Note'), ...exact('note') },
  { title: l10n('Глаза', 'Очі', 'Eyes'), ...exact('eyes') },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (c, { tv }) => tv(c.arc) },
]

export const dn: Game<Character> = {
  id: 'dn',
  label: l10n('Тетрадь смерти', 'Зошит смерті', 'Death Note'),
  category: 'anime',
  description: l10n(
    'Кира, L и синигами — опергруппа, SPK и мафия от первой записи в тетради до финала.',
    'Кіра, L і синігамі — оперативна група, SPK і мафія від першого запису в зошиті до фіналу.',
    'Kira, L and the shinigami — the task force, the SPK and the mafia from the first name written to the end.',
  ),
  accent: '#c0392b',
  modes: ['classic', 'image'],
  featured: ['Light Yagami', 'L', 'Ryuk'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
