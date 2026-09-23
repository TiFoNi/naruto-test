import raw from '@nanda/game/data/bleach.json'
import atlas from '@nanda/game/data/bleach-atlas.json'
import { cells, l10n, EMPTY, type Column, type Entity, type Game } from './types'

type Character = Entity & {
  nameEn: string
  gender: string
  races: string[]
  affiliations: string[]
  ranks: string[]
  powers: string[]
  division: number | null
  arc: string
  arcIndex: number
}

const { list, exact } = cells<Character>()

const DIVISION = l10n('{n}-й отряд', '{n}-й загін', 'Division {n}')


const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Раса', 'Раса', 'Race'), ...list('races') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Должность', 'Посада', 'Rank'), ...list('ranks') },
  { title: l10n('Отряд', 'Загін', 'Division'), key: 'division', text: (g, { tv, lang }) => (g.division ? DIVISION[lang].replace('{n}', String(g.division)) : tv(EMPTY)) },
  { title: l10n('Силы', 'Сили', 'Powers'), ...list('powers') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), key: 'arcIndex', text: (g, { tv }) => tv(g.arc) },
]

export const bleach: Game<Character> = {
  id: 'bleach',
  label: l10n('Блич', 'Бліч', 'Bleach'),
  category: 'anime',
  description: l10n(
    'Шинигами Готея 13, арранкары Айзена и квинси Ванденрейха — от агента шинигами до Тысячелетней войны.',
    'Шінігамі Ґотею 13, арранкари Айзена та квінсі Ванденрайху — від агента шінігамі до Тисячолітньої війни.',
    'Gotei 13 Shinigami, Aizen’s Arrancar and the Wandenreich Quincy — from Substitute Shinigami to the Thousand-Year Blood War.',
  ),
  accent: '#5aa9ff',
  modes: ['classic', 'image'],
  featured: ['Ichigo Kurosaki', 'Rukia Kuchiki', 'Sousuke Aizen', 'Byakuya Kuchiki'],
  unit: 'character',
  entities: raw as Character[],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
