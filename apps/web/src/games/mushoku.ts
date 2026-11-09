import atlas from '@nanda/game/data/mushoku-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  race: string
  role: string[]
  affiliations: string[]
  debut: string
  debutIndex: number
}

const { list, exact } = cells<Character>()

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Раса', 'Раса', 'Race'), ...exact('race') },
  { title: l10n('Занятие', 'Заняття', 'Occupation'), ...list('role') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Дебют в аниме', 'Дебют в аніме', 'Anime debut'), key: 'debutIndex', text: (g, { tv }) => tv(g.debut) },
]

export const mushoku: Game<Character> = {
  id: 'mushoku',
  label: l10n('Реинкарнация безработного', 'Реінкарнація безробітного', 'Mushoku Tensei'),
  category: 'anime',
  description: l10n(
    'Семья Грейрат, ученики Раноа и Семь великих сил — главные герои аниме.',
    'Родина Грейрат, учні Раноа і Сім великих сил — головні герої аніме.',
    'The Greyrat family, Ranoa students and the Seven Great Powers — the main cast of the anime.',
  ),
  accent: '#c8873a',
  modes: ['classic', 'blind', 'image', 'odd', 'pair'],
  featured: ['Rudeus Greyrat', 'Eris Boreas Greyrat', 'Roxy Migurdia', 'Sylphiette'],
  unit: 'character',
  entities: [],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
