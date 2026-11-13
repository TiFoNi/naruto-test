import type { GameId } from './games/types'
import type { L10n } from './i18n'
import { fullUrl, picsUrl } from './pics'

export type QuizOption =
  | { kind: 'entity'; id: number }
  | { kind: 'ability'; hero: number; key: string; name?: L10n | null }
  | { kind: 'text'; text: string }
  | { kind: 'image'; key: string; ver: string; text: string }

export type QuizCover = { kind: 'entity'; id: number } | { kind: 'upload'; key: string; ver: string } | null

export type QuizLayout = 'steps' | 'list'

export type QuizFormat = 'questions' | 'bracket'

export type QuizStatus = 'draft' | 'review' | 'published' | 'rejected'

export type QuizAuthor = { id: string; nickname: string; tag: string | null }

export type QuizKind = 'choice' | 'name' | 'bool' | 'order' | 'pairs'

export type QuizCard = {
  id: string
  game: GameId
  title: string
  cover: QuizCover
  layout: QuizLayout
  format?: QuizFormat
  count: number
  kinds: QuizKind[]
  mine?: { finished: boolean; score: number; answered: number; changed?: boolean } | null
  plays?: number
  likes?: number
  comments?: number
  author?: QuizAuthor | null
}

export type QuizQuestionView = { picture?: QuizCover } & (
  | { kind: 'choice'; text: string; multi: boolean; options: QuizOption[] }
  | { kind: 'name'; text: string }
  | { kind: 'bool'; text: string }
  | { kind: 'order'; text: string; options: QuizOption[] }
  | { kind: 'pairs'; text: string; left: QuizOption[]; right: QuizOption[] }
)

export type QuizValue = number[] | number | null

export type QuizAttempt = {
  answered: number
  finished: boolean
  score: number
  total: number
  answers: QuizValue[]
  results?: { right: boolean; partial?: boolean; correct?: number[] | number }[]
  reveal?: boolean
  xp?: number | null
  champion?: number | null
  voters?: number
  standings?: { champion: number; wins: number; games: number }[]
}

export type QuizView = QuizCard & { questions: QuizQuestionView[]; entries?: QuizOption[]; attempt: QuizAttempt | null; liked?: boolean }

export const coverUrl = (game: GameId, cover: QuizCover) =>
  !cover ? null : cover.kind === 'upload' ? picsUrl(cover.key, cover.ver) : fullUrl(game, cover.id)

export const optionImage = (option: Extract<QuizOption, { kind: 'image' }>) => picsUrl(option.key, option.ver)
