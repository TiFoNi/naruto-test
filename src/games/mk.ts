import raw from '@nanda/game/data/mk.json'
import atlas from '@nanda/game/data/mk-atlas.json'
import { cells, l10n, type Column, type Entity, type Game } from './types'

type Fighter = Entity & {
  nameEn: string
  gender: string
  species: string[]
  affiliations: string[]
  origin: string
  alignment: string
  debut: string
  debutIndex: number
}

const { list, exact } = cells<Fighter>()

const columns: Column<Fighter>[] = [
  { title: l10n('Пол', 'Стать', 'Gender'), ...exact('gender') },
  { title: l10n('Раса', 'Раса', 'Race'), ...list('species') },
  { title: l10n('Принадлеж­ность', 'Належ­ність', 'Affiliation'), ...list('affiliations') },
  { title: l10n('Родное царство', 'Рідне царство', 'Home realm'), ...exact('origin') },
  { title: l10n('Сторона', 'Сторона', 'Alignment'), ...exact('alignment') },
  { title: l10n('Первое появление', 'Перша поява', 'First game'), key: 'debutIndex', text: (g) => g.debut },
]

export const mk: Game<Fighter> = {
  id: 'mk',
  label: l10n('Мортал Комбат', 'Мортал Комбат', 'Mortal Kombat'),
  category: 'games',
  description: l10n(
    'Шаолинь, Лин Куэй, Внешний мир и Преисподняя — бойцы от первой MK до Mortal Kombat 1.',
    'Шаолінь, Лін Куей, Зовнішній світ і Пекло — бійці від першої MK до Mortal Kombat 1.',
    'Shaolin, Lin Kuei, Outworld and the Netherrealm — fighters from the first MK to Mortal Kombat 1.',
  ),
  accent: '#d8a130',
  modes: ['classic', 'image'],
  featured: ['Scorpion', 'Sub-Zero', 'Raiden'],
  unit: 'character',
  entities: raw as Fighter[],
  columns,
  atlas,
  wideImages: false,
  legend: 'debut',
}
