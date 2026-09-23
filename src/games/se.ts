import raw from '../data/se.json'
import atlas from '../data/se-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string[]
  role: string
  affiliations: string[]
  side: string
  status: string
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Вид', 'Вид', 'Species'), ...list('species') },
  { title: l10n('Роль', 'Роль', 'Role'), ...exact('role') },
  { title: l10n('Организация', 'Органі­зація', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Сторона', 'Сторона', 'Side'), ...exact('side') },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (c, { tv }) => tv(c.arc) },
]

export const se: Game<Character> = {
  id: 'se',
  label: l10n('Соул Итер', 'Соул Ітер', 'Soul Eater'),
  category: 'anime',
  description: l10n(
    'Шибусэн, мастера и демоническое оружие — охота за душами кишинов от пролога до Луны.',
    'Шібусен, майстри та демонічна зброя — полювання на душі кішінів від прологу до Місяця.',
    'The DWMA, meisters and demon weapons — hunting kishin souls from the prologue to the moon.',
  ),
  accent: '#cf4b52',
  modes: ['classic', 'image'],
  featured: ['Maka Albarn', 'Soul Evans', 'Death the Kid'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
