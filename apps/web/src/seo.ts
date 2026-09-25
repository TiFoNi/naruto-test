import type { Metadata } from 'next'
import { SITE } from './brand'
import { gameMeta } from './games/meta.server'
import ui from './i18n/ui'
import { LANGS, type Lang } from './i18n/ui'

export const HOME: Record<Lang, { title: string; description: string }> = {
  ru: {
    title: 'NandaGuessr — угадай аниме, мангу и игры',
    description:
      'Угадывай персонажей и тайтлы по признакам и картинкам: Наруто, Ван Пис, Атака титанов, Блич, Тетрадь смерти, Dota 2 и ещё десяток вселенных. Подсказки после каждой попытки, загадка дня и дуэли с друзьями — без лимитов.',
  },
  uk: {
    title: 'NandaGuessr — вгадай аніме, манґу та ігри',
    description:
      'Вгадуй персонажів і тайтли за ознаками й картинками: Наруто, Ван Піс, Атака титанів, Бліч, Зошит смерті, Dota 2 і ще десяток всесвітів. Підказки після кожної спроби, загадка дня та дуелі з друзями — без лімітів.',
  },
  en: {
    title: 'NandaGuessr — guess anime, manga and games',
    description:
      'Guess characters and titles by traits and pictures: Naruto, One Piece, Attack on Titan, Bleach, Death Note, Dota 2 and a dozen more worlds. Hints after every try, a daily puzzle and duels with friends — no limits.',
  },
}

const MODE_LABEL = (lang: Lang, mode: string) => {
  const key = `mode.${mode}` as keyof typeof ui
  return ui[key] ? ui[key][lang] : mode
}

const UNIT = {
  ru: { manga: ['тайтл', 'тайтла', 'тайтлов'], hero: ['героя', 'героев', 'героев'], character: ['персонаж', 'персонажа', 'персонажей'] },
  uk: { manga: ['тайтл', 'тайтли', 'тайтлів'], hero: ['героя', 'героїв', 'героїв'], character: ['персонаж', 'персонажі', 'персонажів'] },
  en: { manga: ['title', 'titles', 'titles'], hero: ['hero', 'heroes', 'heroes'], character: ['character', 'characters', 'characters'] },
} as const

const ACC = {
  ru: { manga: 'тайтл', hero: 'героя', character: 'персонажа' },
  uk: { manga: 'тайтл', hero: 'героя', character: 'персонажа' },
  en: { manga: 'title', hero: 'hero', character: 'character' },
} as const

const plural = (lang: Lang, count: number, forms: readonly string[]) => {
  if (lang === 'en') return count === 1 ? forms[0] : forms[2]
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return forms[2]
  const mod10 = count % 10
  if (mod10 === 1) return forms[0]
  return mod10 >= 2 && mod10 <= 4 ? forms[1] : forms[2]
}

export const alternates = (path: string) => ({
  canonical: path,
  languages: {
    ...Object.fromEntries(LANGS.map(({ id }) => [id, `/${id}${path.replace(/^\/[a-z]{2}/, '')}`])),
    'x-default': `/ru${path.replace(/^\/[a-z]{2}/, '')}`,
  },
})

const GUESS = { ru: 'угадай', uk: 'вгадай', en: 'guess' }
const DAILY = { ru: ', персонаж дня', uk: ', персонаж дня', en: ', daily character' }
const TAIL = {
  ru: 'подсказки после каждой попытки, без лимитов на день.',
  uk: 'підказки після кожної спроби, без лімітів на день.',
  en: 'hints after every try, no daily limits.',
}

export async function playMetadata(lang: Lang, gameId: string, modeId: string, daily: boolean): Promise<Metadata> {
  const game = (await gameMeta()).find((g) => g.id === gameId)
  if (!game) return {}

  const unit = UNIT[lang][game.unit]
  const title = `${game.label[lang]} — ${GUESS[lang]} ${ACC[lang][game.unit]} ${MODE_LABEL(lang, modeId).toLowerCase()}${daily ? DAILY[lang] : ''}`
  const description = `${game.description[lang]} ${game.count} ${plural(lang, game.count, unit)}, ${TAIL[lang]}`
  const path = `/${lang}/play/${gameId}/${modeId}${daily ? '/daily' : ''}`

  return {
    title,
    description,
    alternates: alternates(path),
    ...(daily ? { robots: { index: false } } : {}),
    openGraph: { title, description, url: `${SITE}${path}`, type: 'website' },
  }
}
