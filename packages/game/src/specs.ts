export type GameId =
  | 'mha'
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

export type ModeId = 'classic' | 'blind' | 'image' | 'ability' | 'page' | 'phrase' | 'who' | 'grid' | 'clue' | 'odd' | 'pair' | 'shot' | 'tune'

export type Verdict = 'correct' | 'partial' | 'wrong'

export type Judgement = { verdict: Verdict; arrow?: 'up' | 'down' }

export type JudgeKind = 'exact' | 'list' | 'order' | 'optionalOrder'

export type JudgeSpec = { key: string; kind: JudgeKind }

export type PicShape = 'square' | 'poster' | 'wide'

export type GameSpec = { data: string; images: string; columns: JudgeSpec[]; only?: Record<string, JudgeSpec>; modes?: ModeId[]; shape?: PicShape; featured?: string[] }

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
    modes: ['classic', 'blind', 'image', 'odd', 'pair'],
    columns: [
      col('gender', 'exact'),
      col('species', 'exact'),
      col('side', 'exact'),
      col('teams', 'list'),
      col('powers', 'list'),
      col('debutWork', 'exact'),
    ],
    only: {
      gender: col('screenGender', 'exact'),
      species: col('screenSpecies', 'exact'),
      side: col('screenSide', 'exact'),
      teams: col('screenTeams', 'list'),
      powers: col('screenPowers', 'list'),
      debutWork: col('screenWork', 'exact'),
    },
  },
  football: {
    featured: ['Lionel Messi', 'Cristiano Ronaldo', 'Pelé'],
    data: 'football',
    images: 'football',
    modes: ['classic', 'blind', 'odd', 'pair'],
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
  mha: {
    featured: ['Izuku Midoriya', 'Katsuki Bakugo', 'Shoto Todoroki', 'Toshinori Yagi'],
    data: 'mha',
    images: 'mha',
    columns: [
      col('gender', 'exact'),
      col('quirkType', 'exact'),
      col('side', 'exact'),
      col('affiliations', 'list'),
      col('height', 'order'),
      col('arcIndex', 'order'),
    ],
  },
  genshin: {
    featured: ['Hu Tao', 'Raiden Shogun', 'Zhongli', 'Klee'],
    data: 'genshin',
    images: 'genshin',
    modes: ['classic', 'blind', 'image', 'odd', 'pair'],
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
    modes: ['classic', 'blind', 'image', 'ability', 'phrase', 'odd', 'pair'],
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

export const MODE_IDS: ModeId[] = ['classic', 'blind', 'image', 'ability', 'page', 'phrase', 'odd', 'pair', 'shot', 'tune', 'who', 'grid', 'clue']

export const ABILITY_STAGES = 6
export const ABILITY_HINT_AT = 5

export const MODE_XP: Record<ModeId, number> = {
  classic: 30,
  blind: 50,
  phrase: 10,
  image: 5,
  ability: 5,
  page: 5,
  odd: 8,
  pair: 8,
  shot: 12,
  tune: 12,
  who: 25,
  grid: 25,
  clue: 25,
}

export const MODE_XP_AFTER: Record<ModeId, number> = {
  classic: 15,
  blind: 25,
  phrase: 1,
  image: 1,
  ability: 1,
  page: 1,
  odd: 1,
  pair: 1,
  shot: 3,
  tune: 3,
  who: 5,
  grid: 5,
  clue: 5,
}

export const TITLES = ['admin', 'tester', 'champion', 'runner', 'hundred'] as const

export type TitleId = (typeof TITLES)[number]

export const isTitle = (value: unknown): value is TitleId => (TITLES as readonly string[]).includes(value as string)

export const PROFILE_BLOCKS = ['worlds', 'awards', 'facts', 'activity'] as const

export type ProfileBlock = (typeof PROFILE_BLOCKS)[number]

export const PROFILE_BLOCKS_DEFAULT: ProfileBlock[] = ['worlds', 'awards']

export const isBlock = (value: unknown): value is ProfileBlock => (PROFILE_BLOCKS as readonly string[]).includes(value as string)

export const profileBlocks = (value: unknown) => (Array.isArray(value) ? [...new Set(value.filter(isBlock))] : null)

export const BANNERS = ['frog', 'night', 'sharingan', 'blossom', 'crows', 'fireflies', 'aot', 'kny', 'tg', 'dn', 'tester', 'castle', 'poppies', 'pain', 'levelup', 'snakes', 'touch'] as const

export type Banner = (typeof BANNERS)[number]

export const isBanner = (value: unknown): value is Banner => (BANNERS as readonly string[]).includes(value as string)

export type BannerLook = { x: number; y: number; z: number }

export const BANNER_ZOOM_MAX = 2.5

const within = (value: unknown, low: number, high: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : null

export const LOOK_PLACES = ['desktop', 'tablet', 'phone', 'board'] as const

export type LookPlace = (typeof LOOK_PLACES)[number]

export type BannerLooks = Partial<Record<LookPlace, BannerLook>>

export const bannerLook = (value: unknown): BannerLook | null => {
  if (!value || typeof value !== 'object') return null
  const one = value as Record<string, unknown>
  const x = within(one.x, 0, 100)
  const y = within(one.y, 0, 100)
  const z = within(one.z, 1, BANNER_ZOOM_MAX)
  if (x === null || y === null || z === null) return null
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, z: Math.round(z * 100) / 100 }
}

export const bannerLooks = (value: unknown): BannerLooks | null => {
  if (!value || typeof value !== 'object') return null
  const all = value as Record<string, unknown>
  const found = Object.fromEntries(
    LOOK_PLACES.map((place) => [place, bannerLook(all[place])] as const).filter((pair): pair is [LookPlace, BannerLook] => pair[1] !== null),
  ) as BannerLooks
  return Object.keys(found).length ? found : null
}

export const lookOf = (doc: { banner?: string | null; bannerLooks?: Record<string, unknown> | null }) =>
  doc.banner ? bannerLooks(doc.bannerLooks?.[doc.banner]) : null

export const bannerList = (value: unknown) => (Array.isArray(value) ? [...new Set(value.filter(isBanner))] : null)

export const RARITIES = ['common', 'rare', 'epic', 'legend'] as const

export type Rarity = (typeof RARITIES)[number]

export const RARITY_PRICE: Record<Rarity, { frame: number; banner: number; bundle: number }> = {
  common: { frame: 280, banner: 200, bundle: 400 },
  rare: { frame: 480, banner: 360, bundle: 700 },
  epic: { frame: 800, banner: 640, bundle: 1200 },
  legend: { frame: 1400, banner: 1000, bundle: 2000 },
}

export const FRAME_RARITY: Record<string, Rarity> = {
  pond: 'common',
  maple: 'common',
  crows: 'common',
  blossom: 'common',
  fireflies: 'common',
  aot: 'rare',
  kny: 'rare',
  tg: 'rare',
  dn: 'rare',
}

export const BANNER_RARITY: Record<string, Rarity> = {
  frog: 'common',
  night: 'common',
  crows: 'common',
  blossom: 'common',
  fireflies: 'common',
  aot: 'rare',
  kny: 'rare',
  tg: 'rare',
  dn: 'rare',
  sharingan: 'legend',
  castle: 'rare',
  poppies: 'rare',
  pain: 'epic',
  levelup: 'common',
  snakes: 'epic',
  touch: 'rare',
}

const priced = <T extends Record<string, Rarity>>(rarity: T, kind: 'frame' | 'banner') =>
  Object.fromEntries(Object.entries(rarity).map(([id, tier]) => [id, RARITY_PRICE[tier][kind]])) as Record<string, number>

export const FRAME_COSTS: Record<string, number> = priced(FRAME_RARITY, 'frame')

export const BANNER_COSTS: Record<string, number> = priced(BANNER_RARITY, 'banner')

const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legend: 3 }

const pair = (frame: string, banner: string) => {
  const tier = RANK[FRAME_RARITY[frame]] >= RANK[BANNER_RARITY[banner]] ? FRAME_RARITY[frame] : BANNER_RARITY[banner]
  return { frame, banner, rarity: tier, cost: RARITY_PRICE[tier].bundle }
}

export const BUNDLES = [
  { id: 'pond', ...pair('pond', 'frog') },
  { id: 'maple', ...pair('maple', 'night') },
  { id: 'crows', ...pair('crows', 'crows') },
  { id: 'blossom', ...pair('blossom', 'blossom') },
  { id: 'fireflies', ...pair('fireflies', 'fireflies') },
  { id: 'aot', ...pair('aot', 'aot') },
  { id: 'kny', ...pair('kny', 'kny') },
  { id: 'tg', ...pair('tg', 'tg') },
  { id: 'dn', ...pair('dn', 'dn') },
]

export type Bundle = (typeof BUNDLES)[number]

export const bundleOf = (id: unknown) => BUNDLES.find((one) => one.id === id) ?? null

export const frameRarity = (id: unknown) => (typeof id === 'string' ? (FRAME_RARITY[id] ?? null) : null)

export const bannerRarity = (id: unknown) => (typeof id === 'string' ? (BANNER_RARITY[id] ?? null) : null)

export const frameCost = (id: unknown) => (typeof id === 'string' ? (FRAME_COSTS[id] ?? null) : null)

export const bannerCost = (id: unknown) => (typeof id === 'string' ? (BANNER_COSTS[id] ?? null) : null)

export const bundleFull = (one: Bundle) => (frameCost(one.frame) ?? 0) + (bannerCost(one.banner) ?? 0)

export const TONES = ['naruto', 'onepiece', 'se', 'bc', 'genshin', 'jjk', 'manga', 'hxh', 'jojo', 'kny', 'marvel'] as const

export const TONE_HEX = /^#[0-9a-f]{6}$/i

export const isTone = (value: unknown): value is string =>
  typeof value === 'string' && ((TONES as readonly string[]).includes(value) || TONE_HEX.test(value))

export const HERO_TILES = ['solved', 'duels', 'streak', 'rank', 'awards', 'challenges'] as const

export type HeroTile = (typeof HERO_TILES)[number]

export const HERO_TILES_DEFAULT: (HeroTile | null)[] = ['solved', 'duels', 'streak']

export const HERO_TILES_MAX = 3

export const isHeroTile = (value: unknown): value is HeroTile => (HERO_TILES as readonly string[]).includes(value as string)

export const heroTiles = (value: unknown) => {
  if (!Array.isArray(value)) return null
  const seen = new Set<string>()
  const slots: (HeroTile | null)[] = []
  for (let spot = 0; spot < HERO_TILES_MAX; spot++) {
    const one = value[spot]
    if (isHeroTile(one) && !seen.has(one)) {
      seen.add(one)
      slots.push(one)
    } else slots.push(null)
  }
  return slots
}

export const ONE_TRY_GAMES: GameId[] = ['manga']

export const ONE_TRY_MODES: ModeId[] = ['odd']

export const oneTry = (game: unknown, mode?: unknown) => ONE_TRY_GAMES.includes(game as GameId) || ONE_TRY_MODES.includes(mode as ModeId)

export const DAILY_XP_FACTOR = 3

export const DAILY_XP_MODES: ModeId[] = ['classic', 'blind', 'image', 'ability', 'page', 'phrase', 'odd', 'shot', 'tune']

// режими-забіги: у них нема щоденного варіанта
export const ENDLESS_MODES: ModeId[] = ['pair', 'grid']

export const hasDaily = (mode: ModeId) => !ENDLESS_MODES.includes(mode)

export const ZOOM_LEVELS = [5.1, 3.7, 2.6, 1.9] as const
export const ZOOM_REVEAL = ZOOM_LEVELS.length
export const zoomAt = (step: number) => (step >= ZOOM_LEVELS.length ? 1 : ZOOM_LEVELS[Math.max(0, step)])

export const XP_CAPS = { daily: 400, endless: 300, duel: 200 } as const


export type XpSource = keyof typeof XP_CAPS

export const DUEL_MODES: ModeId[] = ['classic', 'image', 'ability', 'page', 'phrase', 'who', 'grid']

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
  'genshin',
]

export const GRID_SIDE = 3
export const GRID_MIN = 5
export const GRID_MISSES = 3

export const BOARD_SIZES = [4, 5, 6, 7] as const
export const BOARD_DEFAULT = 5
export const TEAM_MODES: ModeId[] = ['classic', 'image', 'ability', 'page', 'phrase', 'clue']

export const DUEL_TEAM_SIZES = [1] as const

export const DUEL_TEAM_COUNTS = [2, 3, 4] as const

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

const DEFAULT_MODES: ModeId[] = ['classic', 'blind', 'image', 'odd', 'pair']

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

export const columnsOf = (game: GameId, only = false) => {
  const { columns, only: swap } = GAME_SPECS[game]
  return only && swap ? columns.map((spec) => swap[spec.key] ?? spec) : columns
}

export function judgeAll(game: GameId, guess: Record<string, unknown>, answer: Record<string, unknown>, only = false) {
  return Object.fromEntries(columnsOf(game, only).map((spec) => [spec.key, judge(spec, guess, answer)]))
}

export type CoinPack = { id: string; usd: number; stars: number; base: number; bonus: number; art: string; grow: number; starsOnly?: boolean }

export const COIN_PACKS: CoinPack[] = [
  { id: 'small', usd: 1.5, stars: 120, base: 300, bonus: 0, art: 'coins-big', grow: 0.78, starsOnly: true },
  { id: 'mid', usd: 4.5, stars: 350, base: 900, bonus: 150, art: 'coins-big', grow: 1 },
  { id: 'big', usd: 12.5, stars: 950, base: 3000, bonus: 600, art: 'coins-big', grow: 1.22 },
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

export const LEVEL_FIRST = 100
export const LEVEL_STEP = 15
export const LEVEL_CAP = 1500

export const levelCost = (level: number) => Math.min(LEVEL_FIRST + LEVEL_STEP * (level - 1), LEVEL_CAP)

const LADDER = (() => {
  const steps: number[] = [0]
  for (let level = 1; level < 300; level++) steps.push(steps[level - 1]! + levelCost(level))
  return steps
})()

export const levelTotal = (level: number) => LADDER[Math.min(Math.max(level, 1), LADDER.length) - 1]!

export function levelAt(xp: number) {
  const total = Math.max(0, Math.floor(xp) || 0)
  let low = 1
  let high = LADDER.length
  while (low < high) {
    const mid = Math.floor((low + high) / 2) + 1
    if (LADDER[mid - 1]! <= total) low = mid
    else high = mid - 1
  }
  const level = low
  return { level, into: total - LADDER[level - 1]!, need: levelCost(level), xp: total }
}

export const LEVEL_BIG = 10
export const LEVEL_MID = 1
export const LEVEL_LAST = 300
export const LEVEL_CHAPTER = 50

export const LEVEL_CHAPTER_COINS = [25, 30, 35, 40, 45, 50]

export const LEVEL_PILE_SPOTS = [5, 15, 35, 45]

export const LEVEL_PRIZE_SPOTS = [10, 20, 25, 30, 40]

export const levelBaseCoins = (level: number) =>
  LEVEL_CHAPTER_COINS[Math.min(Math.floor((level - 1) / LEVEL_CHAPTER), LEVEL_CHAPTER_COINS.length - 1)]!

export const levelCoins = (level: number) => {
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_LAST) return 0
  const spot = level - Math.floor((level - 1) / LEVEL_CHAPTER) * LEVEL_CHAPTER
  if (LEVEL_PRIZE_SPOTS.includes(spot)) return 0
  if (spot === LEVEL_CHAPTER) return levelBaseCoins(level) * 5
  return LEVEL_PILE_SPOTS.includes(spot) ? levelBaseCoins(level) * 3 : levelBaseCoins(level)
}
