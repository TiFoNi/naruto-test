export type GameId =
  | 'genshin'
  | 'marvel'
  | 'football'
  | 'naruto'
  | 'dota'
  | 'aot'
  | 'bleach'
  | 'tg'
  | 'berserk'
  | 'kny'
  | 'onepiece'
  | 'mk'
  | 'hxh'
  | 'bc'
  | 'jojo'
  | 'se'
  | 'ff'
  | 'manga'
  | 'dn'
  | 'avatar'
  | 'jjk'
  | 'csm'
  | 'shots'
  | 'tunes'

export type ModeId = 'classic' | 'image' | 'ability' | 'page' | 'phrase' | 'who' | 'grid' | 'clue' | 'odd' | 'pair' | 'shot' | 'tune'

export type Verdict = 'correct' | 'partial' | 'wrong'

export type Judgement = { verdict: Verdict; arrow?: 'up' | 'down' }

export type JudgeKind = 'exact' | 'list' | 'order' | 'optionalOrder'

export type JudgeSpec = { key: string; kind: JudgeKind }

export type PicShape = 'square' | 'poster' | 'wide'

export type GameSpec = { data: string; images: string; columns: JudgeSpec[]; modes?: ModeId[]; shape?: PicShape; featured?: string[] }

const col = (key: string, kind: JudgeKind): JudgeSpec => ({ key, kind })

export const GAME_SPECS: Record<GameId, GameSpec> = {
  naruto: {
    featured: ['Naruto Uzumaki', 'Sasuke Uchiha', 'Kakashi Hatake', 'Itachi Uchiha'],
    data: 'characters',
    images: 'characters',
    columns: [
      col('gender', 'exact'),
      col('affiliations', 'list'),
      col('jutsuTypes', 'list'),
      col('kekkeiGenkai', 'list'),
      col('natureTypes', 'list'),
      col('attributes', 'list'),
      col('arcIndex', 'order'),
    ],
  },
  aot: {
    featured: ['Eren Yeager', 'Mikasa Ackerman', 'Levi Ackerman', 'Armin Arlert'],
    data: 'aot',
    images: 'aot',
    columns: [
      col('gender', 'exact'),
      col('species', 'list'),
      col('affiliations', 'list'),
      col('occupations', 'list'),
      col('titans', 'list'),
      col('status', 'exact'),
      col('arcIndex', 'order'),
    ],
  },
  bleach: {
    featured: ['Ichigo Kurosaki', 'Rukia Kuchiki', 'Sousuke Aizen', 'Byakuya Kuchiki'],
    data: 'bleach',
    images: 'bleach',
    columns: [
      col('gender', 'exact'),
      col('races', 'list'),
      col('affiliations', 'list'),
      col('ranks', 'list'),
      col('division', 'optionalOrder'),
      col('powers', 'list'),
      col('arcIndex', 'order'),
    ],
  },
  tg: {
    featured: ['Ken Kaneki', 'Touka Kirishima', 'Kishou Arima'],
    data: 'tg',
    images: 'tg',
    columns: [
      col('gender', 'exact'),
      col('species', 'list'),
      col('affiliations', 'list'),
      col('kagune', 'list'),
      col('ratingIndex', 'optionalOrder'),
      col('status', 'exact'),
      col('debutIndex', 'order'),
    ],
  },
  berserk: {
    featured: ['Guts', 'Griffith', 'Casca'],
    data: 'berserk',
    images: 'berserk',
    columns: [
      col('gender', 'exact'),
      col('kinds', 'list'),
      col('affiliations', 'list'),
      col('occupations', 'list'),
      col('status', 'exact'),
      col('arcIndex', 'order'),
    ],
  },
  onepiece: {
    featured: ['Monkey D. Luffy', 'Roronoa Zoro', 'Sanji'],
    data: 'onepiece',
    images: 'onepiece',
    columns: [
      col('gender', 'exact'),
      col('races', 'list'),
      col('affiliations', 'list'),
      col('fruits', 'list'),
      col('haki', 'list'),
      col('bounty', 'order'),
      col('arcIndex', 'order'),
    ],
  },
  jojo: {
    featured: ['Jotaro Kujo', 'Dio Brando', 'Joseph Joestar'],
    data: 'jojo',
    images: 'jojo',
    columns: [
      col('gender', 'exact'),
      col('species', 'list'),
      col('powers', 'list'),
      col('groups', 'list'),
      col('side', 'exact'),
      col('nation', 'exact'),
      col('partIndex', 'order'),
    ],
  },
  dn: {
    featured: ['Light Yagami', 'L', 'Ryuk'],
    data: 'dn',
    images: 'dn',
    columns: [
      col('gender', 'exact'),
      col('species', 'exact'),
      col('orgs', 'list'),
      col('note', 'exact'),
      col('eyes', 'exact'),
      col('status', 'exact'),
      col('arcIndex', 'order'),
    ],
  },
  tunes: {
    featured: ['Naruto: Shippuden', 'Attack on Titan', 'Demon Slayer: Kimetsu no Yaiba'],
    shape: 'poster',
    data: 'tunes',
    images: 'tunes',
    modes: ['tune'],
    columns: [],
  },
  shots: {
    featured: ['Demon Slayer: Kimetsu no Yaiba', 'Attack on Titan', 'Naruto'],
    shape: 'wide',
    data: 'shots',
    images: 'shots',
    modes: ['shot'],
    columns: [],
  },
  manga: {
    featured: ['Berserk', 'Vagabond', 'Slam Dunk'],
    shape: 'poster',
    data: 'manga',
    images: 'manga',
    modes: ['page'],
    columns: [],
  },
  se: {
    featured: ['Maka Albarn', 'Soul Evans', 'Death the Kid'],
    data: 'se',
    images: 'se',
    columns: [
      col('gender', 'exact'),
      col('species', 'list'),
      col('role', 'exact'),
      col('affiliations', 'list'),
      col('side', 'exact'),
      col('status', 'exact'),
      col('arcIndex', 'order'),
    ],
  },
  ff: {
    featured: ['Shinra Kusakabe', 'Arthur Boyle', 'Benimaru Shinmon'],
    data: 'ff',
    images: 'ff',
    columns: [
      col('gender', 'exact'),
      col('generations', 'list'),
      col('affiliations', 'list'),
      col('rank', 'exact'),
      col('side', 'exact'),
      col('status', 'exact'),
      col('arcIndex', 'order'),
    ],
  },
  csm: {
    featured: ['Denji', 'Power', 'Makima'],
    data: 'csm',
    images: 'csm',
    columns: [
      col('gender', 'exact'),
      col('species', 'exact'),
      col('role', 'exact'),
      col('affiliations', 'list'),
      col('arcIndex', 'order'),
    ],
  },
  jjk: {
    featured: ['Yuji Itadori', 'Satoru Gojo', 'Megumi Fushiguro'],
    data: 'jjk',
    images: 'jjk',
    columns: [
      col('gender', 'exact'),
      col('species', 'list'),
      col('grade', 'exact'),
      col('roles', 'list'),
      col('affiliations', 'list'),
      col('arcIndex', 'order'),
    ],
  },
  hxh: {
    featured: ['Gon Freecss', 'Killua Zoldyck', 'Kurapika'],
    data: 'hxh',
    images: 'hxh',
    columns: [
      col('gender', 'exact'),
      col('species', 'list'),
      col('nen', 'exact'),
      col('affiliations', 'list'),
      col('status', 'exact'),
      col('arcIndex', 'order'),
    ],
  },
  bc: {
    featured: ['Asta', 'Yuno Grinberryall', 'Noelle Silva'],
    data: 'bc',
    images: 'bc',
    columns: [
      col('gender', 'exact'),
      col('species', 'exact'),
      col('magic', 'list'),
      col('squad', 'exact'),
      col('country', 'exact'),
      col('status', 'exact'),
      col('arcIndex', 'order'),
    ],
  },
  avatar: {
    featured: ['Aang', 'Zuko', 'Korra'],
    data: 'avatar',
    images: 'avatar',
    columns: [
      col('gender', 'exact'),
      col('nation', 'exact'),
      col('bending', 'list'),
      col('skills', 'list'),
      col('groups', 'list'),
      col('status', 'exact'),
      col('arcIndex', 'order'),
    ],
  },
  kny: {
    featured: ['Tanjiro Kamado', 'Nezuko Kamado', 'Zenitsu Agatsuma'],
    data: 'kny',
    images: 'kny',
    columns: [
      col('gender', 'exact'),
      col('species', 'exact'),
      col('affiliations', 'list'),
      col('rank', 'exact'),
      col('styles', 'list'),
      col('status', 'exact'),
      col('arcIndex', 'order'),
    ],
  },
  mk: {
    featured: ['Scorpion', 'Sub-Zero', 'Raiden'],
    data: 'mk',
    images: 'mk',
    columns: [
      col('gender', 'exact'),
      col('species', 'list'),
      col('affiliations', 'list'),
      col('origin', 'exact'),
      col('alignment', 'exact'),
      col('debutIndex', 'order'),
    ],
  },
  marvel: {
    featured: ['Iron Man', 'Spider-Man', 'Thor'],
    data: 'marvel',
    images: 'marvel',
    modes: ['classic', 'image', 'odd', 'pair'],
    columns: [
      col('gender', 'exact'),
      col('species', 'exact'),
      col('side', 'exact'),
      col('teams', 'list'),
      col('powers', 'list'),
      col('debutIndex', 'order'),
    ],
  },
  football: {
    featured: ['Lionel Messi', 'Cristiano Ronaldo', 'Pelé'],
    data: 'football',
    images: 'football',
    modes: ['classic', 'odd', 'pair'],
    columns: [
      col('country', 'exact'),
      col('part', 'exact'),
      col('roles', 'list'),
      col('club', 'exact'),
      col('status', 'exact'),
      col('height', 'order'),
      col('birth', 'order'),
    ],
  },
  genshin: {
    featured: ['Hu Tao', 'Raiden Shogun', 'Zhongli', 'Klee'],
    data: 'genshin',
    images: 'genshin',
    modes: ['classic', 'image', 'odd', 'pair'],
    columns: [
      col('gender', 'exact'),
      col('element', 'exact'),
      col('weapon', 'exact'),
      col('region', 'exact'),
      col('rarity', 'order'),
      col('year', 'order'),
    ],
  },
  dota: {
    featured: ['Pudge', 'Invoker', 'Crystal Maiden', 'Juggernaut'],
    shape: 'wide',
    data: 'dota',
    images: 'dota',
    modes: ['classic', 'image', 'ability', 'phrase', 'odd', 'pair'],
    columns: [
      col('gender', 'exact'),
      col('species', 'list'),
      col('roles', 'list'),
      col('attribute', 'exact'),
      col('attack', 'exact'),
      col('complexity', 'order'),
      col('year', 'order'),
    ],
  },
}

export const GAME_IDS = Object.keys(GAME_SPECS) as GameId[]

export const MODE_IDS: ModeId[] = ['classic', 'image', 'ability', 'page', 'phrase', 'odd', 'pair', 'shot', 'tune', 'who', 'grid', 'clue']

export const ABILITY_STAGES = 6
export const ABILITY_HINT_AT = 5

export const MODE_XP: Record<ModeId, number> = {
  classic: 30,
  phrase: 10,
  image: 5,
  ability: 5,
  page: 5,
  odd: 8,
  pair: 0,
  shot: 12,
  tune: 0,
  who: 25,
  grid: 25,
  clue: 25,
}

export const MODE_XP_AFTER: Record<ModeId, number> = {
  classic: 12,
  phrase: 4,
  image: 1,
  ability: 1,
  page: 1,
  odd: 2,
  pair: 0,
  shot: 2,
  tune: 0,
  who: 5,
  grid: 5,
  clue: 5,
}

export const PROFILE_BLOCKS = ['worlds', 'awards', 'facts', 'activity'] as const

export type ProfileBlock = (typeof PROFILE_BLOCKS)[number]

export const PROFILE_BLOCKS_DEFAULT: ProfileBlock[] = ['worlds', 'awards']

export const isBlock = (value: unknown): value is ProfileBlock => (PROFILE_BLOCKS as readonly string[]).includes(value as string)

export const profileBlocks = (value: unknown) => (Array.isArray(value) ? [...new Set(value.filter(isBlock))] : null)

export const ONE_TRY_GAMES: GameId[] = ['manga']

export const oneTry = (game: unknown) => ONE_TRY_GAMES.includes(game as GameId)

export const DAILY_XP_FACTOR = 3

export const DAILY_XP_MODES: ModeId[] = ['classic', 'image', 'ability', 'page', 'phrase', 'odd', 'shot']

// режими-забіги: у них нема щоденного варіанта
export const ENDLESS_MODES: ModeId[] = ['pair', 'tune', 'grid']

export const hasDaily = (mode: ModeId) => !ENDLESS_MODES.includes(mode)

export const ZOOM_LEVELS = [7, 5.1, 3.7, 2.6, 1.9, 1.4, 1] as const

export const XP_CAPS = { daily: 400, endless: 300, duel: 200 } as const


export type XpSource = keyof typeof XP_CAPS

export const DUEL_MODES: ModeId[] = ['classic', 'image', 'ability', 'page', 'phrase', 'who', 'grid', 'clue']

// світи, де даних вистачає на сітку з мінімум 5 персонажами в кожній клітинці
export const GRID_GAMES: GameId[] = [
  'naruto',
  'jjk',
  'csm',
  'aot',
  'bleach',
  'tg',
  'onepiece',
  'jojo',
  'se',
  'ff',
  'hxh',
  'bc',
  'avatar',
  'kny',
  'marvel',
  'football',
  'dota',
]

export const GRID_SIDE = 3
export const GRID_MIN = 5
export const GRID_MISSES = 3

export const BOARD_SIZES = [4, 5, 6, 7] as const
export const BOARD_DEFAULT = 5
export const TEAM_MODES: ModeId[] = ['classic', 'image', 'ability', 'page', 'phrase', 'clue']

export const DUEL_TEAM_SIZES = [1, 2, 3] as const

export const DUEL_TEAM_COUNTS = [2, 3] as const

export const CLUE_SIZES = [4, 5, 6] as const
export const CLUE_DEFAULT = 5
export const CLUE_TEAM_SIZES = [2, 3] as const
export const CLUE_WORD_MAX = 24

export type ClueKind = 'own' | 'foe' | 'grey' | 'black'

export const clueSide = (size: unknown) => {
  const asked = Number(size)
  return (CLUE_SIZES as readonly number[]).includes(asked) ? asked : CLUE_DEFAULT
}

export const cluePlan = (size: unknown) => {
  const side = clueSide(size)
  const cells = side * side
  const black = 1
  const first = Math.round(cells * 0.36)
  const second = first - 1
  return { side, cells, black, first, second, grey: cells - black - first - second }
}

export const teamSize = (mode: unknown, value: unknown) => {
  const asked = Number(value)
  if (mode === 'clue') return (CLUE_TEAM_SIZES as readonly number[]).includes(asked) ? asked : 2
  const fits = (DUEL_TEAM_SIZES as readonly number[]).includes(asked)
  return TEAM_MODES.includes(mode as ModeId) && fits ? asked : 1
}

export const teamCount = (mode: unknown, value: unknown) => {
  if (mode === 'clue') return 2
  const asked = Number(value)
  const fits = (DUEL_TEAM_COUNTS as readonly number[]).includes(asked)
  return TEAM_MODES.includes(mode as ModeId) && fits ? asked : 2
}

export const DUEL_ROUNDS = [3, 5, 7, 10] as const
export const DUEL_SECONDS = [30, 60, 90, 600, 1800] as const
export const DUEL_DEFAULT = { best: 5, seconds: 60 }
export const DUEL_MATCH_XP = 50

export const duelWinsNeeded = (best: number) => Math.floor(best / 2) + 1

export const SHOT_POINTS = [12, 10, 8, 6] as const
export const SHOT_MISS = 1

export type TuneLevel = 'easy' | 'normal' | 'hard'

export const TUNE_LEVELS: TuneLevel[] = ['easy', 'normal', 'hard']

export const TUNE_STEPS: Record<TuneLevel, number[]> = {
  easy: [2, 4, 6, 8, 12, 16],
  normal: [1, 2, 4, 7, 11, 16],
  hard: [0.5, 1, 2, 4, 8, 16],
}

export const TUNE_POINTS: Record<TuneLevel, number[]> = {
  easy: [6, 5, 4, 3, 2, 1],
  normal: [8, 6, 5, 4, 2, 1],
  hard: [12, 9, 7, 5, 3, 1],
}

export const TUNE_FULL = 16

export const TUNE_MISS = 1

export const TUNE_PEAKS = 120

export const tuneLevel = (value: unknown): TuneLevel => (TUNE_LEVELS.includes(value as TuneLevel) ? (value as TuneLevel) : 'easy')

export const TUNE_CUTS = [...new Set(TUNE_LEVELS.flatMap((level) => TUNE_STEPS[level]))].sort((a, b) => a - b)

export const PHRASE_EVERY = 3
export const PHRASE_VOICE_AT = 3

const DEFAULT_MODES: ModeId[] = ['classic', 'image', 'odd', 'pair']

export const modesOf = (game: GameId) => GAME_SPECS[game].modes ?? DEFAULT_MODES

export const hasMode = (game: GameId, mode: ModeId) =>
  mode === 'grid' ? GRID_GAMES.includes(game) : modesOf(game).includes(mode)

export const shapeOf = (game: GameId): PicShape => GAME_SPECS[game].shape ?? 'square'

export const statsKey = (game: string, mode: string) => `${game}_${mode}`

export const dailyKey = (game: string, mode: string) => `${statsKey(game, mode)}_daily`

export const STAT_KEYS = GAME_IDS.flatMap((g) => modesOf(g).map((m) => statsKey(g, m)))

export const DAILY_KEYS = GAME_IDS.flatMap((g) => modesOf(g).map((m) => dailyKey(g, m)))

const present = (value: unknown) => typeof value === 'number' && value >= 0

const asList = (value: unknown): string[] => (Array.isArray(value) ? value : value == null ? [] : [String(value)])

export function judge(spec: JudgeSpec, guess: Record<string, unknown>, answer: Record<string, unknown>): Judgement {
  const g = guess[spec.key]
  const a = answer[spec.key]
  switch (spec.kind) {
    case 'exact':
      return { verdict: g === a ? 'correct' : 'wrong' }
    case 'list': {
      const guessList = asList(g)
      const answerSet = new Set(asList(a))
      if (guessList.length === answerSet.size && guessList.every((x) => answerSet.has(x))) return { verdict: 'correct' }
      return { verdict: guessList.some((x) => answerSet.has(x)) ? 'partial' : 'wrong' }
    }
    case 'order':
    case 'optionalOrder': {
      if (spec.kind === 'optionalOrder' && !(present(g) && present(a))) {
        return { verdict: (present(g) ? g : null) === (present(a) ? a : null) ? 'correct' : 'wrong' }
      }
      if (g === a) return { verdict: 'correct' }
      return { verdict: 'wrong', arrow: (a as number) > (g as number) ? 'up' : 'down' }
    }
  }
}

export function judgeAll(game: GameId, guess: Record<string, unknown>, answer: Record<string, unknown>) {
  return Object.fromEntries(GAME_SPECS[game].columns.map((spec) => [spec.key, judge(spec, guess, answer)]))
}

export type CoinPack = { id: string; usd: number; stars: number; base: number; bonus: number; art: string; grow: number }

export const COIN_PACKS: CoinPack[] = [
  { id: 'small', usd: 1.99, stars: 80, base: 250, bonus: 50, art: 'coins-big', grow: 0.78 },
  { id: 'mid', usd: 5.99, stars: 250, base: 1000, bonus: 150, art: 'coins-big', grow: 1 },
  { id: 'big', usd: 17.99, stars: 750, base: 3000, bonus: 500, art: 'coins-big', grow: 1.22 },
]

export const packOf = (id: unknown): CoinPack | null => COIN_PACKS.find((one) => one.id === id) ?? null

export const coinsOf = (pack: CoinPack) => pack.base + pack.bonus

export type PayCoin = { id: string; label: string; note: string }

export const PAY_COINS: PayCoin[] = [
  { id: 'usdttrc20', label: 'USDT', note: 'TRC-20' },
  { id: 'trx', label: 'TRX', note: 'Tron' },
  { id: 'ltc', label: 'LTC', note: 'Litecoin' },
]

export const coinOf = (id: unknown): PayCoin | null => PAY_COINS.find((one) => one.id === id) ?? null

export type PayWay = 'crypto' | 'stars'

export const wayOf = (value: unknown): PayWay | null => (value === 'crypto' || value === 'stars' ? value : null)
