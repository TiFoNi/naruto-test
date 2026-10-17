import { l10n, type Entity, type Game } from './types'

type Tune = Entity & {
  nameEn: string
  year: number | null
  op: number | null
  song: string
  artist: string
  peaks: number[]
}

export const tunes: Game<Tune> = {
  id: 'tunes',
  label: l10n('Угадай опенинг', 'Вгадай опенінг', 'Guess the opening'),
  category: 'anime',
  description: l10n(
    'Слушай первые секунды опенинга и назови тайтл. Не угадал — играет ещё кусочек, но очков меньше.',
    'Слухай перші секунди опенінга й назви тайтл. Не вгадав — грає ще шматок, але очок менше.',
    'Listen to the first seconds of an opening and name the title. Miss, and a longer piece plays for fewer points.',
  ),
  accent: '#f0a830',
  modes: ['tune'],
  featured: ['Naruto: Shippuden', 'Attack on Titan', 'Demon Slayer: Kimetsu no Yaiba'],
  unit: 'manga',
  entities: [],
  columns: [],
  atlas: { cols: 1, rows: 1 },
  wideImages: false,
  legend: 'order',
}
