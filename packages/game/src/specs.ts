export type GameId =
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

export type ModeId = 'classic' | 'image' | 'ability' | 'page' | 'phrase' | 'who' | 'grid'

export type Verdict = 'correct' | 'partial' | 'wrong'

export type Judgement = { verdict: Verdict; arrow?: 'up' | 'down' }

export type JudgeKind = 'exact' | 'list' | 'order' | 'optionalOrder'

export type JudgeSpec = { key: string; kind: JudgeKind }

export type PicShape = 'square' | 'poster' | 'wide'

export type GameSpec = { data: string; images: string; columns: JudgeSpec[]; modes?: ModeId[]; shape?: PicShape }

const col = (key: string, kind: JudgeKind): JudgeSpec => ({ key, kind })

export const GAME_SPECS: Record<GameId, GameSpec> = {
  naruto: {
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
  manga: {
    shape: 'poster',
    data: 'manga',
    images: 'manga',
    modes: ['page'],
    columns: [],
  },
  se: {
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
    data: 'marvel',
    images: 'marvel',
    modes: ['classic', 'image'],
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
    data: 'football',
    images: 'football',
    modes: ['classic'],
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
  dota: {
    shape: 'wide',
    data: 'dota',
    images: 'dota',
    modes: ['classic', 'image', 'ability', 'phrase'],
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

export const MODE_IDS: ModeId[] = ['classic', 'image', 'ability', 'page', 'phrase', 'who', 'grid']

export const ABILITY_STAGES = 6
export const ABILITY_HINT_AT = 5

export const MODE_XP: Record<ModeId, number> = {
  classic: 30,
  phrase: 10,
  image: 5,
  ability: 5,
  page: 5,
  who: 25,
  grid: 25,
}

export const MODE_XP_AFTER: Record<ModeId, number> = {
  classic: 12,
  phrase: 4,
  image: 1,
  ability: 1,
  page: 1,
  who: 5,
  grid: 5,
}

export const DAILY_XP_FACTOR = 3

export const DAILY_XP_MODES: ModeId[] = ['classic', 'image', 'ability', 'page', 'phrase']

export const ZOOM_LEVELS = [7, 5.1, 3.7, 2.6, 1.9, 1.4, 1] as const

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
]

export const GRID_SIDE = 3
export const GRID_MIN = 5
export const GRID_MISSES = 3

export const BOARD_SIZES = [4, 5, 6, 7] as const
export const BOARD_DEFAULT = 5
export const DUEL_ROUNDS = [3, 5, 7, 10] as const
export const DUEL_SECONDS = [30, 60, 90, 600, 1800] as const
export const DUEL_DEFAULT = { best: 5, seconds: 60 }
export const DUEL_MATCH_XP = 50

export const duelWinsNeeded = (best: number) => Math.floor(best / 2) + 1

export const PHRASE_EVERY = 3
export const PHRASE_VOICE_AT = 3

const DEFAULT_MODES: ModeId[] = ['classic', 'image']

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
