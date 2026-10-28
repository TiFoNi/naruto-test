import { quizAttempts, quizzes } from '../db'
import { isGame } from '../games'
import { fail, handle, json, readJson } from '../http'
import { roundOwner } from '../profile'
import { attemptId, finishAttempt, publishedQuiz, quizCard, quizView, readValue } from '../quizzes'

export const LIST = handle(async (request) => {
  const owner = await roundOwner(request)
  const game = new URL(request.url).searchParams.get('game')
  const collection = await quizzes()

  if (!game) {
    const rows = await collection.aggregate<{ _id: string; count: number }>([{ $match: { status: 'published' } }, { $group: { _id: '$game', count: { $sum: 1 } } }]).toArray()
    return json({ counts: Object.fromEntries(rows.map((row) => [row._id, row.count])) }, 200, owner.cookie)
  }
  if (!isGame(game)) return fail(400, 'bad_request')

  const list = await collection.find({ game, status: 'published' }, { sort: { createdAt: -1 } }).toArray()
  const tries = await (await quizAttempts()).find({ userId: owner.id, quizId: { $in: list.map((quiz) => quiz._id!) } }).toArray()
  const mine = new Map(tries.map((one) => [one.quizId.toHexString(), one]))

  return json(
    {
      quizzes: list.map((quiz) => {
        const own = mine.get(quiz._id!.toHexString())
        return { ...quizCard(quiz), mine: own ? { finished: own.finished, score: own.score, answered: own.answers.length } : null }
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
  return json({ quiz: quizView(quiz, attempt) }, 200, owner.cookie)
})

export const PLAY = handle(async (request) => {
  const owner = await roundOwner(request)
  const body = await readJson(request)
  const quiz = await publishedQuiz(body.id)
  if (!quiz) return fail(404, 'not_found')

  const collection = await quizAttempts()
  const _id = attemptId(quiz._id!, owner.id)
  const reply = async () => json({ quiz: quizView(quiz, await collection.findOne({ _id })) }, 200, owner.cookie)

  if (body.action === 'restart') {
    await collection.deleteOne({ _id })
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
    if (pushed.answers.length >= quiz.questions.length) await finishAttempt(quiz, owner.id, pushed.answers)
    return reply()
  }

  if (body.action === 'finish') {
    if (quiz.layout !== 'list') return fail(400, 'bad_request')
    const raw = Array.isArray(body.answers) ? body.answers : []
    if (raw.length !== quiz.questions.length) return fail(400, 'bad_answer')
    const answers = quiz.questions.map((question, at) => readValue(question, raw[at]))
    if (answers.some((one) => one === undefined)) return fail(400, 'bad_answer')
    const done = await finishAttempt(quiz, owner.id, answers as NonNullable<(typeof answers)[number]>[])
    if (!done) return fail(409, 'answered')
    return reply()
  }

  return fail(400, 'bad_request')
})

