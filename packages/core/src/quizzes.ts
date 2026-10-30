import { ObjectId } from 'mongodb'
import { isGame, gameData } from './games'
import { abilityByKey } from './abilities'
import { addXp } from './profile'
import { quizAttempts, quizzes, users, type QuizAttemptDoc, type QuizCover, type QuizDoc, type QuizOption, type QuizQuestion, type QuizStatus, type QuizValue } from './db'

export const QUIZ_XP_PER_ANSWER = 10

export const QUIZ_LIMITS = { title: 80, text: 300, option: 80, note: 300, minOptions: 2, maxOptions: 8, maxPairs: 6, maxQuestions: 30, ownQuizzes: 30 }

const STATUSES: QuizStatus[] = ['draft', 'review', 'published', 'rejected']

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '')

const whole = (value: unknown) => (Number.isInteger(value) ? (value as number) : Number.NaN)

const optionKey = (option: QuizOption) =>
  option.kind === 'entity'
    ? `e:${option.id}`
    : option.kind === 'ability'
      ? `a:${option.hero}:${option.key}`
      : option.kind === 'image'
        ? `i:${option.key}`
        : `t:${option.text.toLowerCase()}`

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
  if (option?.kind === 'image') {
    const key = typeof option.key === 'string' && /^quizzes\/[\w-]+\.webp$/.test(option.key) ? option.key : ''
    const text = clean(option.text, QUIZ_LIMITS.option)
    return key && text ? { kind: 'image', key, ver: clean(option.ver, 16), text } : null
  }
  return null
}

function readPicture(raw: unknown, known: Set<number>): QuizCover {
  const picture = raw as Record<string, unknown> | null
  if (picture?.kind === 'entity' && known.has(whole(picture.id))) return { kind: 'entity', id: whole(picture.id) }
  if (picture?.kind === 'upload' && typeof picture.key === 'string' && /^quizzes\/[\w-]+\.webp$/.test(picture.key)) {
    return { kind: 'upload', key: picture.key, ver: clean(picture.ver, 16) }
  }
  return null
}

async function readQuestion(raw: unknown, known: Set<number>, game: string): Promise<QuizQuestion | string> {
  const question = raw as Record<string, unknown>
  const read = await readBody(question, known, game)
  if (typeof read === 'string') return read
  const picture = readPicture(question.picture, known)
  return picture ? { ...read, picture } : read
}

async function readBody(question: Record<string, unknown>, known: Set<number>, game: string): Promise<QuizQuestion | string> {
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
    const keys = options.map(optionKey)
    if (new Set(keys).size !== keys.length) return 'question_duplicate'
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

const KINDS = ['choice', 'name', 'bool', 'order', 'pairs']

function looseOption(raw: unknown) {
  const option = raw as Record<string, unknown>
  const id = whole(option?.id)
  const hero = whole(option?.hero)
  if (option?.kind === 'entity') return Number.isInteger(id) ? { kind: 'entity', id } : { kind: 'entity' }
  if (option?.kind === 'ability') return { kind: 'ability', ...(Number.isInteger(hero) ? { hero } : {}), ...(option.key ? { key: clean(option.key, 80) } : {}) }
  if (option?.kind === 'image') {
    const key = typeof option.key === 'string' && /^quizzes\/[\w-]+\.webp$/.test(option.key) ? option.key : undefined
    return { kind: 'image', ...(key ? { key, ver: clean(option.ver, 16) } : {}), text: clean(option.text, QUIZ_LIMITS.option) }
  }
  return { kind: 'text', text: clean(option?.text, QUIZ_LIMITS.option) }
}

function looseQuestion(raw: unknown, known: Set<number>) {
  const question = raw as Record<string, unknown>
  const kind = KINDS.includes(question?.kind as string) ? (question.kind as string) : 'choice'
  const text = clean(question?.text, QUIZ_LIMITS.text)
  const list = (value: unknown, max: number) => (Array.isArray(value) ? value.slice(0, max) : []).map(looseOption)
  const picture = readPicture(question?.picture, known)
  const base = { kind, text, ...(picture ? { picture } : {}) }
  if (kind === 'name') return { ...base, ...(Number.isInteger(whole(question.answer)) ? { answer: whole(question.answer) } : {}) }
  if (kind === 'bool') return { ...base, ...(typeof question.answer === 'boolean' ? { answer: question.answer } : {}) }
  if (kind === 'order') return { ...base, options: list(question.options, QUIZ_LIMITS.maxOptions) }
  if (kind === 'pairs') return { ...base, left: list(question.left, QUIZ_LIMITS.maxPairs), right: list(question.right, QUIZ_LIMITS.maxPairs) }
  const options = list(question.options, QUIZ_LIMITS.maxOptions)
  const correct = (Array.isArray(question.correct) ? question.correct : []).map(whole).filter((at) => at >= 0 && at < options.length)
  return { ...base, multi: question.multi === true, options, correct }
}

export async function readQuiz(
  raw: unknown,
  loose = false,
): Promise<{ quiz: Omit<QuizDoc, '_id' | 'createdAt' | 'updatedAt'>; complete: boolean } | { error: string; at?: number }> {
  const body = raw as Record<string, unknown>
  const game = typeof body?.game === 'string' && isGame(body.game) ? body.game : null
  if (!game) return { error: 'game' }
  const title = clean(body.title, QUIZ_LIMITS.title)
  if (!title && !loose) return { error: 'title' }
  let complete = !!title
  const layout = body.layout === 'list' ? 'list' : 'steps'
  const status = STATUSES.includes(body.status as QuizStatus) ? (body.status as QuizStatus) : 'draft'

  const { byId } = await gameData(game)
  const known = new Set(byId.keys())

  const cover = readPicture(body.cover, known)

  const list = Array.isArray(body.questions) ? body.questions : []
  if (list.length > QUIZ_LIMITS.maxQuestions || (!list.length && !loose)) return { error: 'questions' }
  if (!list.length) complete = false
  const questions: QuizQuestion[] = []
  for (const [at, one] of list.entries()) {
    const question = await readQuestion(one, known, game)
    if (typeof question !== 'string') questions.push(question)
    else if (!loose) return { error: question, at }
    else {
      complete = false
      questions.push(looseQuestion(one, known) as never)
    }
  }

  return { quiz: { game, title, cover, layout, status, official: true, questions, note: clean(body.note, QUIZ_LIMITS.note) }, complete }
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
  return { ...viewBody(quiz, at), picture: quiz.questions[at]!.picture ?? null }
}

function viewBody(quiz: QuizDoc, at: number) {
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

export type QuizAuthor = { id: string; nickname: string; tag: string | null }

export async function quizAuthors(list: QuizDoc[]) {
  const ids = [...new Set(list.filter((quiz) => quiz.authorId).map((quiz) => quiz.authorId!.toHexString()))].map((id) => new ObjectId(id))
  if (!ids.length) return new Map<string, QuizAuthor>()
  const people = await (await users()).find({ _id: { $in: ids } }, { projection: { nickname: 1, tag: 1 } }).toArray()
  return new Map(people.map((one) => [one._id!.toHexString(), { id: one._id!.toHexString(), nickname: one.nickname ?? '—', tag: one.tag ?? null }]))
}

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
  const first = (attempt.runs ?? 1) <= 1
  return {
    ...base,
    answers: attempt.answers,
    reveal: !first,
    xp: first ? (attempt.xp ?? 0) : null,
    results: quiz.questions.map((_, at) => {
      const right = isRight(quiz, at, attempt.answers[at] ?? null)
      return first ? { right } : { right, correct: solution(quiz, at) }
    }),
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

export async function finishAttempt(quiz: QuizDoc, userId: ObjectId, answers: QuizValue[], guest: boolean) {
  const score = quiz.questions.reduce((sum, _, at) => sum + (isRight(quiz, at, answers[at] ?? null) ? 1 : 0), 0)
  const collection = await quizAttempts()
  const done = await collection.findOneAndUpdate(
    { _id: attemptId(quiz._id!, userId), finished: false },
    { $set: { answers, finished: true, score, total: quiz.questions.length, finishedAt: new Date() }, $inc: { runs: 1 } },
    { returnDocument: 'after' },
  )
  if (!done || done.runs !== 1) return done
  const xp = guest || quiz.authorId?.equals(userId) ? 0 : score * QUIZ_XP_PER_ANSWER
  if (xp > 0) await addXp(await users(), userId, xp, 'endless', undefined, xp)
  await collection.updateOne({ _id: done._id }, { $set: { xp } })
  return { ...done, xp }
}

export async function restartAttempt(quiz: QuizDoc, userId: ObjectId) {
  const collection = await quizAttempts()
  const _id = attemptId(quiz._id!, userId)
  await collection.updateOne({ _id, finished: true, runs: { $exists: false } }, { $set: { runs: 1 } })
  await collection.updateOne(
    { _id },
    { $set: { answers: [], finished: false, score: 0, total: quiz.questions.length, startedAt: new Date() }, $unset: { finishedAt: '' } },
  )
}
