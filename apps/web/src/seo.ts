import type { Metadata } from 'next'
import { SITE } from './brand'
import { gameMeta } from './games/meta.server'
import ui from './i18n/ui'
import { faq } from './HomeAbout'
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
  ru: { manga: ['тайтл', 'тайтла', 'тайтлов'], hero: ['героя', 'героев', 'героев'], character: ['персонаж', 'персонажа', 'персонажей'], player: ['футболист', 'футболиста', 'футболистов'] },
  uk: { manga: ['тайтл', 'тайтли', 'тайтлів'], hero: ['героя', 'героїв', 'героїв'], character: ['персонаж', 'персонажі', 'персонажів'], player: ['футболіст', 'футболісти', 'футболістів'] },
  en: { manga: ['title', 'titles', 'titles'], hero: ['hero', 'heroes', 'heroes'], character: ['character', 'characters', 'characters'], player: ['player', 'players', 'players'] },
} as const

const ACC = {
  ru: { manga: 'тайтл', hero: 'героя', character: 'персонажа', player: 'футболиста' },
  uk: { manga: 'тайтл', hero: 'героя', character: 'персонажа', player: 'футболіста' },
  en: { manga: 'title', hero: 'hero', character: 'character', player: 'player' },
} as const

const plural = (lang: Lang, count: number, forms: readonly string[]) => {
  if (lang === 'en') return count === 1 ? forms[0] : forms[2]
  const mod100 = count % 100
  if (mod100 >= 11 && mod100 <= 14) return forms[2]
  const mod10 = count % 10
  if (mod10 === 1) return forms[0]
  return mod10 >= 2 && mod10 <= 4 ? forms[1] : forms[2]
}

export const alternates = (path: string) => {
  const bare = path.replace(/^\/[a-z]{2}/, '')
  return {
    canonical: path,
    languages: {
      ...Object.fromEntries(LANGS.map(({ id }) => [id, `/${id}${bare}`])),
      'x-default': `/en${bare}`,
    },
  }
}

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

  const short = ui[daily ? 'seo.ogDaily' : 'seo.ogPlay'][lang]

  return {
    title,
    description,
    alternates: alternates(path),
    openGraph: { title, description: short, url: `${SITE}${path}`, type: 'website' },
    twitter: { card: 'summary_large_image' },
  }
}

const WORLDS = {
  ru: { list: 'Вселенные', forms: ['вселенная', 'вселенные', 'вселенных'], cards: ['карточка', 'карточки', 'карточек'] },
  uk: { list: 'Всесвіти', forms: ['всесвіт', 'всесвіти', 'всесвітів'], cards: ['картка', 'картки', 'карток'] },
  en: { list: 'Worlds', forms: ['world', 'worlds', 'worlds'], cards: ['card', 'cards', 'cards'] },
} as const

const TOP = {
  ru: 'Наруто, Ван Пис, Атака титанов, Блич, Тетрадь смерти, Dota 2 и другие',
  uk: 'Наруто, Ван Піс, Атака титанів, Бліч, Зошит смерті, Dota 2 та інші',
  en: 'Naruto, One Piece, Attack on Titan, Bleach, Death Note, Dota 2 and more',
} as const

const ENDING = {
  ru: 'Подсказки после каждой попытки, загадка дня и дуэли с друзьями — без лимитов.',
  uk: 'Підказки після кожної спроби, загадка дня та дуелі з друзями — без лімітів.',
  en: 'Hints after every try, a daily puzzle and duels with friends — no limits.',
} as const

const summary = (lang: Lang, worlds: number, cards: number) =>
  `${worlds} ${plural(lang, worlds, WORLDS[lang].forms)} і ${cards} ${plural(lang, cards, WORLDS[lang].cards)}: ${TOP[lang]}. ${ENDING[lang]}`
    .replace(' і ', lang === 'ru' ? ' и ' : lang === 'en' ? ' and ' : ' і ')

export async function homeCopy(lang: Lang) {
  const games = await gameMeta()
  const cards = games.reduce((sum, game) => sum + game.count, 0)
  return { title: HOME[lang].title, description: summary(lang, games.length, cards) }
}

export async function homeSchema(lang: Lang) {
  const games = await gameMeta()
  const cards = games.reduce((sum, game) => sum + game.count, 0)
  const home = `${SITE}/${lang}`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE}/#website`,
        name: 'NandaGuessr',
        url: home,
        inLanguage: lang,
        description: summary(lang, games.length, cards),
      },
      {
        '@type': 'VideoGame',
        '@id': `${SITE}/#game`,
        name: 'NandaGuessr',
        url: home,
        inLanguage: LANGS.map(({ id }) => id),
        applicationCategory: 'GameApplication',
        gamePlatform: 'Web browser',
        genre: ['Quiz', 'Puzzle'],
        playMode: ['SinglePlayer', 'MultiPlayer'],
        operatingSystem: 'Any',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
        description: summary(lang, games.length, cards),
      },
      {
        '@type': 'FAQPage',
        '@id': `${SITE}/#faq`,
        mainEntity: faq(lang, games).map((row) => ({
          '@type': 'Question',
          name: row.q,
          acceptedAnswer: { '@type': 'Answer', text: row.a },
        })),
      },
      {
        '@type': 'ItemList',
        '@id': `${SITE}/#worlds`,
        name: WORLDS[lang].list,
        numberOfItems: games.length,
        itemListElement: games.map((game, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: game.label[lang],
          url: `${SITE}/${lang}/play/${game.id}/${game.modes[0]}`,
          description: `${game.count} ${plural(lang, game.count, UNIT[lang][game.unit])}`,
        })),
      },
    ],
  }
}

export async function playSchema(lang: Lang, gameId: string, modeId: string) {
  const game = (await gameMeta()).find((one) => one.id === gameId)
  if (!game) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: `${game.label[lang]} — ${MODE_LABEL(lang, modeId)}`,
    url: `${SITE}/${lang}/play/${gameId}/${modeId}`,
    inLanguage: lang,
    isPartOf: { '@id': `${SITE}/#game` },
    gamePlatform: 'Web browser',
    genre: ['Quiz', 'Puzzle'],
    isAccessibleForFree: true,
    description: `${game.description[lang]} ${game.count} ${plural(lang, game.count, UNIT[lang][game.unit])}.`,
    numberOfItems: game.count,
  }
}
