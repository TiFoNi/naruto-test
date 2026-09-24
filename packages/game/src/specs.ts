export type GameId = 'naruto' | 'dota' | 'aot' | 'bleach' | 'tg' | 'berserk' | 'kny' | 'onepiece' | 'mk' | 'hxh' | 'bc' | 'jojo' | 'se' | 'ff' | 'manga' | 'dn' | 'avatar'

export type ModeId = 'classic' | 'image' | 'ability' | 'page'

export type Verdict = 'correct' | 'partial' | 'wrong'

export type Judgement = { verdict: Verdict; arrow?: 'up' | 'down' }

export type JudgeKind = 'exact' | 'list' | 'order' | 'optionalOrder'

export type JudgeSpec = { key: string; kind: JudgeKind }

export type GameSpec = { data: string; images: string; columns: JudgeSpec[]; modes?: ModeId[] }

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
  dota: {
    data: 'dota',
    images: 'dota',
    modes: ['classic', 'image', 'ability'],
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

export const MODE_IDS: ModeId[] = ['classic', 'image', 'ability', 'page']

export const ABILITY_STAGES = 5
export const ABILITY_HINT_AT = 5

const DEFAULT_MODES: ModeId[] = ['classic', 'image']

export const modesOf = (game: GameId) => GAME_SPECS[game].modes ?? DEFAULT_MODES

export const hasMode = (game: GameId, mode: ModeId) => modesOf(game).includes(mode)

export const statsKey = (game: string, mode: string) => `${game}_${mode}`

export const dailyKey = (game: string, mode: string) => `${statsKey(game, mode)}_daily`

export const STAT_KEYS = GAME_IDS.flatMap((g) => modesOf(g).map((m) => statsKey(g, m)))

export const DAILY_KEYS = GAME_IDS.flatMap((g) => modesOf(g).map((m) => dailyKey(g, m)))

const present = (value: unknown) => typeof value === 'number' && value >= 0

export function judge(spec: JudgeSpec, guess: Record<string, unknown>, answer: Record<string, unknown>): Judgement {
  const g = guess[spec.key]
  const a = answer[spec.key]
  switch (spec.kind) {
    case 'exact':
      return { verdict: g === a ? 'correct' : 'wrong' }
    case 'list': {
      const guessList = (g as string[]) ?? []
      const answerSet = new Set((a as string[]) ?? [])
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
