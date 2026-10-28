import { ObjectId } from 'mongodb'
import { isGame, gameData } from './games'
import { abilityByKey } from './abilities'
import { quizAttempts, quizzes, type QuizAttemptDoc, type QuizCover, type QuizDoc, type QuizOption, type QuizQuestion, type QuizValue } from './db'

export const QUIZ_LIMITS = { title: 80, text: 300, option: 80, minOptions: 2, maxOptions: 8, maxPairs: 6, maxQuestions: 50 }

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '')

const whole = (value: unknown) => (Number.isInteger(value) ? (value as number) : Number.NaN)

async function readOption(raw: unknown, known: Set<number>, game: string): Promise<QuizOption | null> {
  const option = raw as Record<string, unknown>
  if (option?.kind === 'entity') {
    const id = whole(option.id)
    return known.has(id) ? { kind: 'entity', id } : null
  }
  if (option?.kind === 'ability') {
    const hero = whole(option.hero)
    const key = clean(option.key, 80)
    return game === 'dota' && abilityByKey(hero, key) ? { kind: 'ability', hero, key } : null
  }
  if (option?.kind === 'text') {
    const text = clean(option.text, QUIZ_LIMITS.option)
    return text ? { kind: 'text', text } : null
  }
  return null
}

async function readQuestion(raw: unknown, known: Set<number>, game: string): Promise<QuizQuestion | string> {
  const question = raw as Record<string, unknown>
  const text = clean(question?.text, QUIZ_LIMITS.text)
  if (!text) return 'question_text'

  if (question.kind === 'name') {
    const answer = whole(question.answer)
    return known.has(answer) ? { kind: 'name', text, answer } : 'question_answer'
  }

  if (question.kind === 'bool') {
    return typeof question.answer === 'boolean' ? { kind: 'bool', text, answer: question.answer } : 'question_answer'
  }

  const readList = async (raw: unknown, max: number) => {
    const list = Array.isArray(raw) ? raw : []
    if (list.length < QUIZ_LIMITS.minOptions || list.length > max) return 'question_options'
    const options: QuizOption[] = []
    for (const one of list) {
      const option = await readOption(one, known, game)
      if (!option) return 'question_option'
      options.push(option)
    }
    return options
  }

  if (question.kind === 'order') {
    const options = await readList(question.options, QUIZ_LIMITS.maxOptions)
    return typeof options === 'string' ? options : { kind: 'order', text, options }
  }

  if (question.kind === 'pairs') {
    const left = await readList(question.left, QUIZ_LIMITS.maxPairs)
    if (typeof left === 'string') return left === 'question_options' ? 'question_pairs' : left
    const right = await readList(question.right, QUIZ_LIMITS.maxPairs)
    if (typeof right === 'string') return right === 'question_options' ? 'question_pairs' : right
    if (left.length !== right.length) return 'question_pairs'
    return { kind: 'pairs', text, left, right }
  }

  if (question.kind === 'choice') {
    const options = await readList(question.options, QUIZ_LIMITS.maxOptions)
    if (typeof options === 'string') return options
    const multi = question.multi === true
    const correct = [...new Set((Array.isArray(question.correct) ? question.correct : []).map(whole))]
      .filter((index) => index >= 0 && index < options.length)
      .sort((a, b) => a - b)
    if (!correct.length || (!multi && correct.length !== 1)) return 'question_correct'
    return { kind: 'choice', text, multi, options, correct }
  }

  return 'question_kind'
}

export async function readQuiz(raw: unknown): Promise<{ quiz: Omit<QuizDoc, '_id' | 'createdAt' | 'updatedAt'> } | { error: string; at?: number }> {
  const body = raw as Record<string, unknown>
  const game = typeof body?.game === 'string' && isGame(body.game) ? body.game : null
  if (!game) return { error: 'game' }
  const title = clean(body.title, QUIZ_LIMITS.title)
  if (!title) return { error: 'title' }
  const layout = body.layout === 'list' ? 'list' : 'steps'
  const status = body.status === 'published' ? 'published' : 'draft'

  const { byId } = await gameData(game)
  const known = new Set(byId.keys())

  const coverRaw = body.cover as Record<string, unknown> | null
  let cover: QuizCover = null
  if (coverRaw?.kind === 'entity' && known.has(whole(coverRaw.id))) cover = { kind: 'entity', id: whole(coverRaw.id) }
  if (coverRaw?.kind === 'upload' && typeof coverRaw.key === 'string' && /^quizzes\/[\w-]+\.webp$/.test(coverRaw.key)) {
    cover = { kind: 'upload', key: coverRaw.key, ver: clean(coverRaw.ver, 16) }
  }

  const list = Array.isArray(body.questions) ? body.questions : []
  if (!list.length || list.length > QUIZ_LIMITS.maxQuestions) return { error: 'questions' }
  const questions: QuizQuestion[] = []
  for (const [at, one] of list.entries()) {
    const question = await readQuestion(one, known, game)
    if (typeof question === 'string') return { error: question, at }
    questions.push(question)
  }

  return { quiz: { game, title, cover, layout, status, official: true, questions } }
}

const optionView = (option: QuizOption) => {
  if (option.kind === 'ability') return { ...option, name: abilityByKey(option.hero, option.key)?.name ?? null }
  return option
}

function shuffleFor(seed: string, size: number) {
  let state = 2166136261
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619)
  const random = () => {
    state = (state + 0x6d2b79f5) | 0
    let mix = Math.imul(state ^ (state >>> 15), 1 | state)
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296
  }
  const order = Array.from({ length: size }, (_, at) => at)
  for (let at = size - 1; at > 0; at -= 1) {
    const pick = Math.floor(random() * (at + 1))
    ;[order[at], order[pick]] = [order[pick]!, order[at]!]
  }
  if (size > 1 && order.every((one, at) => one === at)) order.push(order.shift()!)
  return order
}

const sizeOf = (question: QuizQuestion) => (question.kind === 'order' ? question.options.length : question.kind === 'pairs' ? question.right.length : 0)

const shownOrder = (quiz: QuizDoc, at: number) => shuffleFor(`${quiz._id?.toHexString() ?? ''}:${at}`, sizeOf(quiz.questions[at]!))

const inverse = (order: number[]) => order.reduce<number[]>((all, original, shown) => Object.assign(all, { [original]: shown }), [])

function questionView(quiz: QuizDoc, at: number) {
  const question = quiz.questions[at]!
  const { kind, text } = question
  if (question.kind === 'choice') return { kind, text, multi: question.multi, options: question.options.map(optionView) }
  if (question.kind === 'order') return { kind, text, options: shownOrder(quiz, at).map((one) => optionView(question.options[one]!)) }
  if (question.kind === 'pairs') {
    return { kind, text, left: question.left.map(optionView), right: shownOrder(quiz, at).map((one) => optionView(question.right[one]!)) }
  }
  return { kind, text }
}

function solution(quiz: QuizDoc, at: number) {
  const question = quiz.questions[at]!
  if (question.kind === 'choice') return question.correct
  if (question.kind === 'name') return question.answer
  if (question.kind === 'bool') return question.answer ? 1 : 0
  return inverse(shownOrder(quiz, at))
}

function isRight(quiz: QuizDoc, at: number, value: QuizValue) {
  const correct = solution(quiz, at)
  if (typeof correct === 'number') return value === correct
  if (!Array.isArray(value)) return false
  const given = quiz.questions[at]!.kind === 'choice' ? [...new Set(value)].sort((a, b) => a - b) : value
  return given.length === correct.length && given.every((one, place) => one === correct[place])
}

export function readValue(question: QuizQuestion, raw: unknown): QuizValue | undefined {
  if (raw === null) return null
  if (question.kind === 'name') return Number.isInteger(raw) ? (raw as number) : undefined
  if (question.kind === 'bool') return raw === 0 || raw === 1 ? raw : undefined
  if (!Array.isArray(raw)) return undefined
  if (question.kind === 'order' || question.kind === 'pairs') {
    const size = sizeOf(question)
    const list = raw.map(whole)
    const valid = list.length === size && new Set(list).size === size && list.every((one) => one >= 0 && one < size)
    return valid ? list : undefined
  }
  const picks = [...new Set(raw.map(whole))].filter((index) => index >= 0 && index < question.options.length).sort((a, b) => a - b)
  if (!picks.length || (!question.multi && picks.length > 1)) return undefined
  return picks
}

export const kindsOf = (quiz: QuizDoc) => [...new Set(quiz.questions.map((question) => question.kind))]

export function quizCard(quiz: QuizDoc) {
  return {
    id: quiz._id!.toHexString(),
    game: quiz.game,
    title: quiz.title,
    cover: quiz.cover,
    layout: quiz.layout,
    count: quiz.questions.length,
    kinds: kindsOf(quiz),
  }
}

export function attemptView(quiz: QuizDoc, attempt: QuizAttemptDoc | null) {
  if (!attempt) return null
  const base = { answered: attempt.answers.length, finished: attempt.finished, score: attempt.score, total: quiz.questions.length }
  if (!attempt.finished) return { ...base, answers: quiz.layout === 'list' ? [] : attempt.answers }
  return {
    ...base,
    answers: attempt.answers,
    results: quiz.questions.map((_, at) => ({ right: isRight(quiz, at, attempt.answers[at] ?? null), correct: solution(quiz, at) })),
  }
}

export function quizView(quiz: QuizDoc, attempt: QuizAttemptDoc | null) {
  return { ...quizCard(quiz), questions: quiz.questions.map((_, at) => questionView(quiz, at)), attempt: attemptView(quiz, attempt) }
}

export const attemptId = (quizId: ObjectId, userId: ObjectId) => `${quizId.toHexString()}:${userId.toHexString()}`

export async function publishedQuiz(id: unknown) {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) return null
  return (await quizzes()).findOne({ _id: new ObjectId(id), status: 'published' })
}

export async function finishAttempt(quiz: QuizDoc, userId: ObjectId, answers: QuizValue[]) {
  const score = quiz.questions.reduce((sum, _, at) => sum + (isRight(quiz, at, answers[at] ?? null) ? 1 : 0), 0)
  return (await quizAttempts()).findOneAndUpdate(
    { _id: attemptId(quiz._id!, userId), finished: false },
    { $set: { answers, finished: true, score, total: quiz.questions.length, finishedAt: new Date() } },
    { returnDocument: 'after' },
  )
}
