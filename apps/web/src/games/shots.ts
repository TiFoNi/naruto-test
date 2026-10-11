import { l10n, type Entity, type Game } from './types'

type Shot = Entity & {
  nameEn: string
  slug: string
  year: number
  shots: number
}

export const shots: Game<Shot> = {
  id: 'shots',
  label: l10n('Угадай аниме', 'Вгадай аніме', 'Guess the anime'),
  category: 'anime',
  description: l10n(
    'Четыре кадра от самого сложного к самому простому. Чем раньше назовёшь тайтл, тем больше очков.',
    'Чотири кадри від найскладнішого до найпростішого. Чим раніше назвеш тайтл, тим більше очок.',
    'Four frames, from the hardest to the easiest. Name the title early and score more.',
  ),
  accent: '#ff6f91',
  modes: ['shot'],
  featured: ['Attack on Titan', 'Death Note', 'Naruto'],
  unit: 'manga',
  entities: [],
  columns: [],
  atlas: { cols: 1, rows: 1 },
  wideImages: true,
  legend: 'order',
}
