import raw from '../data/manga.json'
import atlas from '../data/manga-atlas.json'
import { l10n, type Entity, type Game } from './types'

type Manga = Entity & {
  nameEn: string
  slug: string
  author: string
  year: number
  demographic: string
  status: string
  pages: number
}

const ready = (raw as Manga[]).filter((m) => m.answer).map((m) => m.nameEn)
const preferred = ['Berserk', 'Vagabond', 'Slam Dunk']

export const manga: Game<Manga> = {
  id: 'manga',
  label: l10n('Манга', 'Манга', 'Manga'),
  category: 'manga',
  description: l10n(
    'Страница из манги — три варианта ответа. Угадай тайтл по рисовке, штриховке и тому, как автор строит кадр.',
    'Сторінка з манги — три варіанти відповіді. Вгадай тайтл за малюнком, штрихуванням і тим, як автор будує кадр.',
    'A page from a manga and three answers. Name the title by the linework, the screentones and the panel layout.',
  ),
  accent: '#7f8cff',
  modes: ['page'],
  featured: [...new Set([...preferred.filter((n) => ready.includes(n)), ...ready])].slice(0, 3),
  unit: 'manga',
  entities: raw as Manga[],
  columns: [],
  atlas,
  wideImages: false,
  legend: 'order',
}
