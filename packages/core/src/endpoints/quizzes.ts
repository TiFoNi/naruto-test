import type { ObjectId } from 'mongodb'
import { quizAttempts, quizLikes, quizzes, type QuizAttemptDoc, type QuizDoc } from '../db'
import { isGame } from '../games'
import { fail, handle, json, readJson } from '../http'
import { roundOwner } from '../profile'
import { attemptId, finishAttempt, publishedQuiz, quizAuthors, quizCard, quizView, readValue, restartAttempt } from '../quizzes'

async function liked(quiz: QuizDoc, userId: ObjectId) {
  const likes = await quizLikes()
  const [count, mine] = await Promise.all([likes.countDocuments({ quizId: quiz._id! }), likes.countDocuments({ _id: attemptId(quiz._id!, userId) }, { limit: 1 })])
  return { likes: count, liked: mine > 0 }
}

const fullView = async (quiz: QuizDoc, attempt: QuizAttemptDoc | null, userId: ObjectId) => ({
  ...quizView(quiz, attempt),
  ...(await liked(quiz, userId)),
  author: quiz.authorId ? ((await quizAuthors([quiz])).get(quiz.authorId.toHexString()) ?? null) : null,
})

export const LIST = handle(async (request) => {
  const owner = await roundOwner(request)
  const search = new URL(request.url).searchParams
  const games = (search.get('games') ?? search.get('game') ?? '').split(',').filter(Boolean)
  const collection = await quizzes()

  if (!games.length) {
    const rows = await collection.aggregate<{ _id: string; count: number }>([{ $match: { status: 'published' } }, { $group: { _id: '$game', count: { $sum: 1 } } }]).toArray()
    return json({ counts: Object.fromEntries(rows.map((row) => [row._id, row.count])) }, 200, owner.cookie)
  }
  if (games.length > 50 || !games.every((one) => isGame(one))) return fail(400, 'bad_request')

  const list = await collection.find({ game: { $in: games }, status: 'published' }, { sort: { createdAt: -1 } }).toArray()
  const ids = list.map((quiz) => quiz._id!)
  const attempts = await quizAttempts()
  const tries = await attempts.find({ userId: owner.id, quizId: { $in: ids } }).toArray()
  const mine = new Map(tries.map((one) => [one.quizId.toHexString(), one]))
  const counted = await attempts
    .aggregate<{ _id: unknown; count: number }>([{ $match: { quizId: { $in: ids }, finished: true } }, { $group: { _id: '$quizId', count: { $sum: 1 } } }])
    .toArray()
  const plays = new Map(counted.map((row) => [String(row._id), row.count]))
  const hearts = await (await quizLikes())
    .aggregate<{ _id: unknown; count: number }>([{ $match: { quizId: { $in: ids } } }, { $group: { _id: '$quizId', count: { $sum: 1 } } }])
    .toArray()
  const likes = new Map(hearts.map((row) => [String(row._id), row.count]))
  const authors = await quizAuthors(list)

  return json(
    {
      quizzes: list.map((quiz) => {
        const own = mine.get(quiz._id!.toHexString())
        return {
          ...quizCard(quiz),
          plays: plays.get(quiz._id!.toHexString()) ?? 0,
          likes: likes.get(quiz._id!.toHexString()) ?? 0,
          author: quiz.authorId ? (authors.get(quiz.authorId.toHexString()) ?? null) : null,
          mine: own ? { finished: own.finished, score: own.score, answered: own.answers.length } : null,
        }
      }),
    },
    200,
    owner.cookie,
  )
})

export const ONE = handle(async (request) => {
  const owner = await roundOwner(request)
  const quiz = await publishedQuiz(new URL(request.url).searchParams.get('id'))
  if (!quiz) return fail(404, 'not_found')
  const attempt = await (await quizAttempts()).findOne({ _id: attemptId(quiz._id!, owner.id) })
  return json({ quiz: await fullView(quiz, attempt, owner.id) }, 200, owner.cookie)
})

export const LIKE = handle(async (request) => {
  const owner = await roundOwner(request)
  if (owner.guest) return fail(401, 'login')
  const body = await readJson(request)
  const quiz = await publishedQuiz(body.id)
  if (!quiz) return fail(404, 'not_found')
  const likes = await quizLikes()
  const _id = attemptId(quiz._id!, owner.id)
  if (body.like === true) await likes.updateOne({ _id }, { $setOnInsert: { quizId: quiz._id!, userId: owner.id, at: new Date() } }, { upsert: true })
  else await likes.deleteOne({ _id })
  return json(await liked(quiz, owner.id), 200, owner.cookie)
})

export const PLAY = handle(async (request) => {
  const owner = await roundOwner(request)
  const body = await readJson(request)
  const quiz = await publishedQuiz(body.id)
  if (!quiz) return fail(404, 'not_found')

  const collection = await quizAttempts()
  const _id = attemptId(quiz._id!, owner.id)
  const reply = async () => json({ quiz: await fullView(quiz, await collection.findOne({ _id }), owner.id) }, 200, owner.cookie)

  if (body.action === 'restart') {
    await restartAttempt(quiz, owner.id)
    return reply()
  }

  await collection.updateOne(
    { _id },
    {
      $setOnInsert: {
        quizId: quiz._id!,
        userId: owner.id,
        answers: [],
        finished: false,
        score: 0,
        total: quiz.questions.length,
        startedAt: new Date(),
      },
    },
    { upsert: true },
  )

  if (body.action === 'answer') {
    if (quiz.layout !== 'steps') return fail(400, 'bad_request')
    const index = Number(body.index)
    const question = quiz.questions[index]
    if (!Number.isInteger(index) || !question) return fail(400, 'bad_request')
    const value = readValue(question, body.value)
    if (value === undefined) return fail(400, 'bad_answer')
    const pushed = await collection.findOneAndUpdate(
      { _id, finished: false, answers: { $size: index } },
      { $push: { answers: value } },
      { returnDocument: 'after' },
    )
    if (!pushed) return fail(409, 'answered')
    if (pushed.answers.length >= quiz.questions.length) await finishAttempt(quiz, owner.id, pushed.answers, owner.guest)
    return reply()
  }

  if (body.action === 'finish') {
    if (quiz.layout !== 'list') return fail(400, 'bad_request')
    const raw = Array.isArray(body.answers) ? body.answers : []
    if (raw.length !== quiz.questions.length) return fail(400, 'bad_answer')
    const answers = quiz.questions.map((question, at) => readValue(question, raw[at]))
    if (answers.some((one) => one === undefined)) return fail(400, 'bad_answer')
    const done = await finishAttempt(quiz, owner.id, answers as NonNullable<(typeof answers)[number]>[], owner.guest)
    if (!done) return fail(409, 'answered')
    return reply()
  }

  return fail(400, 'bad_request')
})

