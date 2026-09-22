import raw from '../data/bleach.json'
import atlas from '../data/bleach-atlas.json'
import { cells, compareOrdered, l10n, EMPTY, type Cell, type Column, type Entity, type Game, type RenderContext } from './types'

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

const base = import.meta.env.BASE_URL
const { list, exact } = cells<Character>()

const DIVISION = l10n('{n}-й отряд', '{n}-й загін', 'Division {n}')

function division(g: Character, a: Character, { tv, lang }: RenderContext): Cell {
  const text = g.division ? DIVISION[lang].replace('{n}', String(g.division)) : tv(EMPTY)
  if (g.division && a.division) return { ...compareOrdered(g.division, a.division), text }
  return { verdict: g.division === a.division ? 'correct' : 'wrong', text }
}

const columns: Column<Character>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), render: exact('gender') },
  { title: l10n('Раса', 'Раса', 'Race'), render: list('races') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), render: list('affiliations') },
  { title: l10n('Должность', 'Посада', 'Rank'), render: list('ranks') },
  { title: l10n('Отряд', 'Загін', 'Division'), render: division },
  { title: l10n('Силы', 'Сили', 'Powers'), render: list('powers') },
  { title: l10n('Дебют', 'Дебют', 'Debut'), render: (g, a, { tv }) => ({ ...compareOrdered(g.arcIndex, a.arcIndex), text: tv(g.arc) }) },
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
  atlasUrl: `${base}bleach/thumbs.webp`,
  fullUrl: (c) => `${base}bleach/full/${c.id}.webp`,
  wideImages: false,
  legend: 'debut',
}
