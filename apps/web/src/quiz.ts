import type { GameId } from './games/types'
import type { L10n } from './i18n'
import { fullUrl, picsUrl } from './pics'

export type QuizOption =
  | { kind: 'entity'; id: number }
  | { kind: 'ability'; hero: number; key: string; name?: L10n | null }
  | { kind: 'text'; text: string }

export type QuizCover = { kind: 'entity'; id: number } | { kind: 'upload'; key: string; ver: string } | null

export type QuizLayout = 'steps' | 'list'

export type QuizKind = 'choice' | 'name' | 'bool' | 'order' | 'pairs'

export type QuizCard = {
  id: string
  game: GameId
  title: string
  cover: QuizCover
  layout: QuizLayout
  count: number
  kinds: QuizKind[]
  mine?: { finished: boolean; score: number; answered: number } | null
  plays?: number
}

export type QuizQuestionView =
  | { kind: 'choice'; text: string; multi: boolean; options: QuizOption[] }
  | { kind: 'name'; text: string }
  | { kind: 'bool'; text: string }
  | { kind: 'order'; text: string; options: QuizOption[] }
  | { kind: 'pairs'; text: string; left: QuizOption[]; right: QuizOption[] }

export type QuizValue = number[] | number | null

export type QuizAttempt = {
  answered: number
  finished: boolean
  score: number
  total: number
  answers: QuizValue[]
  results?: { right: boolean; correct?: number[] | number }[]
  reveal?: boolean
  xp?: number | null
}

export type QuizView = QuizCard & { questions: QuizQuestionView[]; attempt: QuizAttempt | null }

export const coverUrl = (game: GameId, cover: QuizCover) =>
  !cover ? null : cover.kind === 'upload' ? picsUrl(cover.key, cover.ver) : fullUrl(game, cover.id)
