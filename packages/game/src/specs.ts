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
  | 'mushoku'
  | 'kuroko'
  | 'got'
  | 'brawl'
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
  mushoku: {
    featured: ['Rudeus Greyrat', 'Eris Boreas Greyrat', 'Roxy Migurdia', 'Sylphiette'],
    data: 'mushoku',
    images: 'mushoku',
    columns: [
      col('gender', 'exact'),
      col('race', 'exact'),
      col('role', 'list'),
      col('affiliations', 'list'),
      col('debutIndex', 'order'),
    ],
  },
  got: {
    featured: ['Jon Snow', 'Daenerys Targaryen', 'Tyrion Lannister', 'Arya Stark'],
    data: 'got',
    images: 'got',
    columns: [
      col('gender', 'exact'),
      col('houses', 'list'),
      col('cultures', 'list'),
      col('orgs', 'list'),
      col('status', 'exact'),
      col('season', 'order'),
    ],
  },
  kuroko: {
    featured: ['Tetsuya Kuroko', 'Taiga Kagami', 'Daiki Aomine', 'Seijūrō Akashi'],
    data: 'kuroko',
    images: 'kuroko',
    columns: [
      col('gender', 'exact'),
      col('teams', 'list'),
      col('position', 'list'),
      col('height', 'order'),
      col('group', 'exact'),
      col('episode', 'order'),
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
  brawl: {
    featured: ['Shelly', 'Colt', 'Spike', 'Leon'],
    data: 'brawl',
    images: 'brawl',
    modes: ['classic', 'blind', 'image', 'odd', 'pair'],
    columns: [
      col('gender', 'exact'),
      col('kind', 'exact'),
      col('rarityIndex', 'order'),
      col('rangeIndex', 'order'),
      col('speedIndex', 'order'),
      col('release', 'order'),
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
      col('region', 'list'),
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

export const HIDDEN_GAMES: GameId[] = []

export const OPEN_GAMES = GAME_IDS.filter((game) => !HIDDEN_GAMES.includes(game))

export const MODE_IDS: ModeId[] = ['classic', 'blind', 'image', 'ability', 'page', 'phrase', 'odd', 'pair', 'shot', 'tune', 'who', 'grid', 'clue']

export const ABILITY_STAGES = 6
export const ABILITY_HINT_AT = 5

export const XP_DYNAMIC = false

export const MODE_XP: Record<ModeId, number> = {
  classic: 55,
  blind: 60,
  phrase: 12,
  image: 4,
  ability: 8,
  page: 3,
  odd: 4,
  pair: 4,
  shot: 12,
  tune: 12,
  who: 25,
  grid: 25,
  clue: 25,
}

export const MODE_XP_AFTER: Record<ModeId, number> = {
  classic: 25,
  blind: 30,
  phrase: 4,
  image: 1,
  ability: 3,
  page: 1,
  odd: 1,
  pair: 1,
  shot: 3,
  tune: 3,
  who: 5,
  grid: 5,
  clue: 5,
}

export const TITLES = ['admin', 'tester', 'champion', 'runner', 'hundred', 'patron'] as const

export type TitleId = (typeof TITLES)[number]

export const isTitle = (value: unknown): value is TitleId => (TITLES as readonly string[]).includes(value as string)

export const PROFILE_BLOCKS = ['worlds', 'awards', 'cards', 'facts', 'activity'] as const

export type ProfileBlock = (typeof PROFILE_BLOCKS)[number]

export const PROFILE_BLOCKS_DEFAULT: ProfileBlock[] = ['worlds', 'awards', 'cards']

export const isBlock = (value: unknown): value is ProfileBlock => (PROFILE_BLOCKS as readonly string[]).includes(value as string)

export const profileBlocks = (value: unknown) => (Array.isArray(value) ? [...new Set(value.filter(isBlock))] : null)

export const BANNERS = ['frog', 'night', 'sharingan', 'blossom', 'crows', 'fireflies', 'aot', 'kny', 'tg', 'dn', 'tester', 'castle', 'poppies', 'pain', 'levelup', 'snakes', 'touch', 'golden', 'lonely', 'rinnegan', 'wanted', 'itachi', 'pixelspider', 'redmoon', 'fireforce', 'ronaldo', 'wasted', 'glowmeadow', 'moonvortex', 'jinx', 'nighttree', 'blockhome', 'moonfield', 'demon', 'lotus', 'clouds', 'byakugan', 'spikedesert', 'frieren'] as const

export type Banner = (typeof BANNERS)[number]

export const isBanner = (value: unknown): value is Banner => (BANNERS as readonly string[]).includes(value as string)

export type BannerLook = { x: number; y: number; z: number; lift?: number }

export const BANNER_ZOOM_MAX = 2.5

export const BANNER_LIFT_MAX = 120

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
  const lift = within(one.lift, 0, BANNER_LIFT_MAX)
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, z: Math.round(z * 100) / 100, ...(lift ? { lift: Math.round(lift) } : {}) }
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

export const RARITY_PRICE: Record<Rarity, { frame: number; banner: number }> = {
  common: { frame: 450, banner: 350 },
  rare: { frame: 650, banner: 500 },
  epic: { frame: 900, banner: 700 },
  legend: { frame: 1400, banner: 1000 },
}

export const FRAME_RARITY: Record<string, Rarity> = {
  pond: 'common',
  maple: 'rare',
  crows: 'rare',
  blossom: 'common',
  fireflies: 'common',
  aot: 'rare',
  kny: 'rare',
  tg: 'rare',
  dn: 'rare',
  bones: 'common',
  magma: 'common',
  dragon: 'rare',
  holo: 'common',
  glitch: 'common',
  nekohood: 'epic',
  sakura: 'epic',
  bearhood: 'epic',
  bunnyhood: 'epic',
  thorns: 'epic',
  barbed: 'epic',
  spikes: 'epic',
  blockring: 'epic',
  moonbloom: 'rare',
  demonring: 'common',
  chrome: 'legend',
  orb: 'legend',
  liquid: 'legend',
  comets: 'legend',
  fire: 'legend',
  lightning: 'legend',
  particles: 'legend',
  wings: 'legend',
  ferrofluid: 'legend',
  atom: 'legend',
}

export const BANNER_RARITY: Record<string, Rarity> = {
  frog: 'common',
  night: 'rare',
  crows: 'common',
  blossom: 'common',
  fireflies: 'common',
  aot: 'rare',
  kny: 'rare',
  tg: 'rare',
  dn: 'rare',
  sharingan: 'legend',
  castle: 'epic',
  poppies: 'rare',
  pain: 'epic',
  levelup: 'common',
  snakes: 'epic',
  touch: 'rare',
  golden: 'epic',
  lonely: 'epic',
  rinnegan: 'rare',
  itachi: 'rare',
  wanted: 'epic',
  redmoon: 'epic',
  pixelspider: 'common',
  fireforce: 'epic',
  ronaldo: 'epic',
  wasted: 'common',
  glowmeadow: 'epic',
  moonvortex: 'rare',
  jinx: 'rare',
  nighttree: 'epic',
  blockhome: 'epic',
  moonfield: 'epic',
  demon: 'common',
  lotus: 'legend',
  clouds: 'legend',
  byakugan: 'legend',
  spikedesert: 'rare',
  frieren: 'epic',
}

const priced = <T extends Record<string, Rarity>>(rarity: T, kind: 'frame' | 'banner') =>
  Object.fromEntries(Object.entries(rarity).map(([id, tier]) => [id, RARITY_PRICE[tier][kind]])) as Record<string, number>

export const FRAME_COSTS: Record<string, number> = priced(FRAME_RARITY, 'frame')

export const BANNER_COSTS: Record<string, number> = priced(BANNER_RARITY, 'banner')

const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legend: 3 }

const pair = (frame: string, banner: string) => {
  const tier = RANK[FRAME_RARITY[frame]] >= RANK[BANNER_RARITY[banner]] ? FRAME_RARITY[frame] : BANNER_RARITY[banner]
  return { frame, banner, rarity: tier, cost: FRAME_COSTS[frame]! + BANNER_COSTS[banner]! }
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
  { id: 'blocky', ...pair('blockring', 'blockhome') },
  { id: 'moonlit', ...pair('moonbloom', 'moonfield') },
  { id: 'demonic', ...pair('demonring', 'demon') },
]

export type Bundle = (typeof BUNDLES)[number]

export const bundleOf = (id: unknown) => BUNDLES.find((one) => one.id === id) ?? null

export const frameRarity = (id: unknown) => (typeof id === 'string' ? (FRAME_RARITY[id] ?? null) : null)

export const bannerRarity = (id: unknown) => (typeof id === 'string' ? (BANNER_RARITY[id] ?? null) : null)

export const frameCost = (id: unknown) => (typeof id === 'string' ? (FRAME_COSTS[id] ?? null) : null)

export const bannerCost = (id: unknown) => (typeof id === 'string' ? (BANNER_COSTS[id] ?? null) : null)

export const BANNER_SCRAP = 0.5

export const scrapValue = (id: unknown) => {
  const cost = bannerCost(id)
  return cost ? Math.floor(cost * BANNER_SCRAP) : null
}

export const REACTIONS = ['like', 'laugh', 'heart', 'puke', 'meh'] as const

export type Reaction = (typeof REACTIONS)[number]

export const PATRON_REACTIONS: Reaction[] = ['puke', 'meh']

export const isReaction = (value: unknown): value is Reaction => typeof value === 'string' && (REACTIONS as readonly string[]).includes(value)

export type Sale = { id: string; off: number; from: number; to: number }

type YearlySale = { id: string; off: number; month: number; day: number; days: number }

export const YEARLY_SALES: YearlySale[] = [{ id: '1111', off: 0.11, month: 11, day: 11, days: 1 }]

const SALE_ZONE = 'Europe/Kyiv'

const zoneShift = (at: number) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: SALE_ZONE,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  )
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - at
}

const zoneMidnight = (year: number, month: number, day: number) => {
  const wall = Date.UTC(year, month - 1, day)
  return wall - zoneShift(wall - zoneShift(wall))
}

const windowOf = (one: YearlySale, year: number): Sale => ({
  id: one.id,
  off: one.off,
  from: zoneMidnight(year, one.month, one.day),
  to: zoneMidnight(year, one.month, one.day + one.days),
})

export const salesAround = (now: number) => {
  const year = new Date(now).getUTCFullYear()
  return [year - 1, year, year + 1].flatMap((each) => YEARLY_SALES.map((one) => windowOf(one, each)))
}

export const saleAt = (now: number) => salesAround(now).find((one) => now >= one.from && now < one.to) ?? null

export const nextSaleEdge = (now: number) =>
  salesAround(now)
    .flatMap((one) => [one.from, one.to])
    .filter((at) => at > now)
    .sort((one, two) => one - two)[0]

export const comingSale = (id: string, now: number) => salesAround(now).find((one) => one.id === id && one.to > now) ?? null

export const salePrice = (cost: number, sale: Sale | null) => (sale ? Math.round(cost * (1 - sale.off)) : cost)

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

export const LIMIT_MODES: ModeId[] = ['classic', 'blind']

export const GUESS_SHARE = 0.3

export const GUESS_CAP = 20

export const guessLimit = (game: unknown, mode: unknown, pool: number) =>
  LIMIT_MODES.includes(mode as ModeId) && !oneTry(game, mode) && pool > 0 ? Math.max(1, Math.min(GUESS_CAP, Math.ceil(pool * GUESS_SHARE))) : null

export const POOL_XP_BASE = 100

export const poolXpFactor = (mode: unknown, pool: number) =>
  LIMIT_MODES.includes(mode as ModeId) && pool > 0 ? Math.min(1.5, Math.max(0.5, Math.sqrt(pool / POOL_XP_BASE))) : 1

export const poolXp = (base: number, mode: unknown, pool: number) => {
  const factor = poolXpFactor(mode, pool)
  return factor === 1 ? base : Math.max(5, Math.round((base * factor) / 5) * 5)
}

export const poolXpPastCap = (base: number, mode: unknown, pool: number) => {
  if (!LIMIT_MODES.includes(mode as ModeId) || pool <= 0) return base
  const share = pool / POOL_XP_BASE
  return Math.max(1, Math.round(base * (share < 1 ? share ** 1.5 : Math.min(1.5, Math.sqrt(share)))))
}

export const DAILY_XP_FACTOR = 3

export const TRIES_REF: Partial<Record<ModeId, number>> = { classic: 6.5, blind: 6.5, image: 1.85, ability: 3, phrase: 9 }

export const TRIES_FACTOR = { min: 0.5, max: 2.5, pastCap: 1.5 } as const

export const TRIES_MIN_PLAYERS = 10

export const TRIES_PRIOR = 5

export const PACE_MODES: ModeId[] = ['classic', 'blind', 'image', 'ability', 'page', 'phrase', 'odd', 'pair', 'shot', 'tune']

export const LOGGED_MODES: ModeId[] = ['pair', 'shot', 'tune']

export const PACE = { perMinute: 22, perMinuteAfter: 10, thinkCapMs: 60_000, guessCapMs: 45_000, duelCapMs: 10 * 60_000, playerRounds: 300, worldBonusPower: 0.5, worldBonusLow: 0.75, worldBonusHigh: 1.35, minWins: 200, priorWins: 100, spread: 3 } as const

export const DUEL_PACE_MODES: ModeId[] = ['who', 'grid', 'clue']

export const PACE_TARGET: Partial<Record<ModeId, number>> = { classic: 35, blind: 45, image: 17, ability: 26, page: 28, odd: 26 }

export const PACE_FALLBACK: Partial<Record<ModeId, number>> = { shot: 0.5 }

export const manualXp = (mode: ModeId, value: number) => Math.max(1, Math.round(value * (PACE_FALLBACK[mode] ?? 1)))

export const PACE_AUTO = { farmerPerMinute: 40, think: 1.9, thinkModes: ['classic', 'blind'] as ModeId[], heavyRounds: 100, minPlayers: 3, minRounds: 500, low: 14, high: 50 } as const

export const autoTarget = (mode: ModeId, faster: number) => {
  const bonus = PACE_AUTO.thinkModes.includes(mode) ? PACE_AUTO.think : 1
  return Math.min(PACE_AUTO.high, Math.max(PACE_AUTO.low, (PACE_AUTO.farmerPerMinute * bonus) / Math.max(1, faster)))
}

export type Pace = { base: number; after: number; msPerWin: number; target: number }

export const triesFactor = (tries: number, ref: number) => (ref > 0 ? Math.min(TRIES_FACTOR.max, Math.max(TRIES_FACTOR.min, tries / ref)) : 1)

export const roundXp = (value: number) => (value >= 25 ? Math.max(5, Math.round(value / 5) * 5) : Math.max(1, Math.round(value)))

const poolShrink = (mode: ModeId, pool: number) => (LIMIT_MODES.includes(mode) && pool > 0 && pool < POOL_XP_BASE ? (pool / POOL_XP_BASE) ** 1.5 : 1)

export const triesXp = (mode: ModeId, factor: number, base: number = MODE_XP[mode]) => roundXp(base * factor)

export const triesXpPastCap = (mode: ModeId, factor: number, pool: number, after: number = MODE_XP_AFTER[mode]) =>
  Math.max(1, Math.round(after * Math.min(TRIES_FACTOR.pastCap, factor) * poolShrink(mode, pool)))

export const paceFromTime = (mode: ModeId, msPerWin: number, target: number = PACE_TARGET[mode] ?? PACE.perMinute): Pace => {
  const minutes = msPerWin / 60_000
  return { base: target * minutes, after: (target * PACE.perMinuteAfter * minutes) / PACE.perMinute, msPerWin, target }
}

export const paceWithin = (mode: ModeId, pace: Pace): Pace => {
  const keep = (value: number, manual: number) => Math.min(manual * PACE.spread, Math.max(manual / PACE.spread, value))
  return { ...pace, base: keep(pace.base, MODE_XP[mode]), after: keep(pace.after, MODE_XP_AFTER[mode]) }
}

export const CARD_STEPS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 2 },
  { level: 4, xp: 4 },
  { level: 7, xp: 7 },
  { level: 15, xp: 15 },
  { level: 30, xp: 30 },
] as const

export const CARD_PINS_MAX = 16

export const CARD_PINS_FREE = 12

export const cardPinsMax = (titles?: readonly string[] | null) => (titles?.includes('patron') ? CARD_PINS_MAX : CARD_PINS_FREE)

export const CARD_MAX_LEVEL = CARD_STEPS[CARD_STEPS.length - 1]!.xp

export const CARD_POINTS: Partial<Record<ModeId, number>> = {
  image: 1,
  ability: 1,
  page: 1,
  phrase: 1,
  odd: 1,
  shot: 1,
  tune: 1,
  classic: 3,
  blind: 4,
}

export const CARD_DAILY_FACTOR = 2

export const cardPoints = (mode: ModeId, daily = false) => (CARD_POINTS[mode] ?? 0) * (daily ? CARD_DAILY_FACTOR : 1)

export const CARD_RARITIES = ['paper', 'bronze', 'silver', 'gold', 'legend', 'mythic'] as const

export type CardRarity = (typeof CARD_RARITIES)[number]

export function cardRank(xp: number) {
  const total = Math.max(0, xp)
  let tier = 0
  while (tier + 1 < CARD_STEPS.length && total >= CARD_STEPS[tier + 1]!.xp) tier++
  const next = CARD_STEPS[tier + 1]
  const level = Math.max(1, Math.min(total, CARD_MAX_LEVEL))
  return { tier, rarity: CARD_RARITIES[tier]!, level, xp: total, next: next ? { xp: next.xp, rarity: CARD_RARITIES[tier + 1]! } : null }
}

export const DAILY_XP_MODES: ModeId[] = ['classic', 'blind', 'image', 'ability', 'page', 'phrase', 'odd', 'shot', 'tune']

// режими-забіги: у них нема щоденного варіанта
export const ENDLESS_MODES: ModeId[] = ['pair', 'grid']

export const hasDaily = (mode: ModeId) => !ENDLESS_MODES.includes(mode)

export const ZOOM_LEVELS = [3.7, 2.6, 1.9] as const
export const ZOOM_REVEAL = ZOOM_LEVELS.length
export const zoomAt = (step: number) => (step >= ZOOM_LEVELS.length ? 1 : ZOOM_LEVELS[Math.max(0, step)])

export const XP_CAPS = { daily: 800, endless: 600 } as const


export type XpSource = keyof typeof XP_CAPS

export const DUEL_MODES: ModeId[] = ['classic', 'blind', 'image', 'ability', 'page', 'phrase', 'who', 'grid']

export const DUEL_FILTER_MODES: ModeId[] = ['classic', 'blind', 'image', 'ability', 'page', 'phrase', 'who', 'grid', 'clue']

export const TABLE_MODES: ModeId[] = ['classic', 'blind']

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
export const DUEL_SECONDS = [60, 180, 600, 1800] as const
export const DUEL_DEFAULT = { best: 5, seconds: 600 }

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
  { id: 'small', usd: 1.25, stars: 100, base: 250, bonus: 0, art: 'coins-big', grow: 0.78, starsOnly: true },
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

export type PollText = { ru: string; uk: string; en: string }
export type PollOption = { id: string; label: PollText }
export type PollGroup = { id: string; label: PollText; max: number; options: PollOption[] }

export const POLL = {
  id: 'next-world-1',
  groups: [
    {
      id: 'anime',
      label: { ru: 'Аниме', uk: 'Аніме', en: 'Anime' },
      max: 2,
      options: [
        { id: 'sao', label: { ru: 'Мастера меча онлайн', uk: 'Майстри меча онлайн', en: 'Sword Art Online' } },
        { id: 'nanatsu', label: { ru: 'Семь смертных грехов', uk: 'Сім смертних гріхів', en: 'The Seven Deadly Sins' } },
        { id: 'rezero', label: { ru: 'Re:Zero', uk: 'Re:Zero', en: 'Re:Zero' } },
        { id: 'shaman', label: { ru: 'Шаман Кинг', uk: 'Шаман Кінг', en: 'Shaman King' } },
        { id: 'dragonball', label: { ru: 'Драгонболл', uk: 'Драгонбол', en: 'Dragon Ball' } },
        { id: 'kuroko', label: { ru: 'Баскетбол Куроко', uk: 'Баскетбол Куроко', en: "Kuroko's Basketball" } },
        { id: 'mushoku', label: { ru: 'Реинкарнация безработного', uk: 'Реінкарнація безробітного', en: 'Mushoku Tensei' } },
        { id: 'edgerunners', label: { ru: 'Киберпанк: Бегущие по краю', uk: 'Кіберпанк: Ті, хто біжать краєм', en: 'Cyberpunk: Edgerunners' } },
        { id: 'vinland', label: { ru: 'Сага о Винланде', uk: 'Сага про Вінланд', en: 'Vinland Saga' } },
        { id: 'sakamoto', label: { ru: 'Дни Сакамото', uk: 'Дні Сакамото', en: 'Sakamoto Days' } },
        { id: 'haikyu', label: { ru: 'Волейбол!!', uk: 'Волейбол!!', en: 'Haikyu!!' } },
        { id: 'geass', label: { ru: 'Код Гиасс', uk: 'Код Ґіасс', en: 'Code Geass' } },
      ],
    },
    {
      id: 'shows',
      label: { ru: 'Сериалы и мульты', uk: 'Серіали й мульти', en: 'Shows & cartoons' },
      max: 1,
      options: [
        { id: 'got', label: { ru: 'Игра престолов', uk: 'Гра престолів', en: 'Game of Thrones' } },
        { id: 'winx', label: { ru: 'Винкс', uk: 'Вінкс', en: 'Winx Club' } },
        { id: 'theboys', label: { ru: 'Пацаны', uk: 'Хлопаки', en: 'The Boys' } },
        { id: 'twilight', label: { ru: 'Сумерки', uk: 'Сутінки', en: 'Twilight' } },
      ],
    },
  ] as PollGroup[],
}
