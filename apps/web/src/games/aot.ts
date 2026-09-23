import raw from '@nanda/game/data/aot.json'
import atlas from '@nanda/game/data/aot-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  species: string[]
  affiliations: string[]
  occupations: string[]
  titans: string[]
  status: string
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Вид', 'Вид', 'Species'), ...list('species') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Род занятий', 'Рід занять', 'Occupation'), ...list('occupations') },
  { title: l10n('Сила титана', 'Сила титана', 'Titan power'), ...list('titans') },
  { title: l10n('Статус', 'Статус', 'Status'), ...exact('status') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const aot: Game<Character> = {
  id: 'aot',
  label: l10n('Атака титанов', 'Атака титанів', 'Attack on Titan'),
  category: 'anime',
  description: l10n(
    'Разведкорпус, воины Марли и держатели Девяти титанов — от падения Шиганшины до Гула.',
    'Розвідкорпус, воїни Марлі та носії Дев’яти титанів — від падіння Шіґаншини до Гулу.',
    'The Survey Corps, Marley’s warriors and the Nine Titans — from the fall of Shiganshina to the Rumbling.',
  ),
  accent: '#b89b62',
  modes: ['classic', 'image'],
  featured: ['Eren Yeager', 'Mikasa Ackerman', 'Levi Ackerman', 'Armin Arlert'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
