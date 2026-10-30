import { ObjectId } from 'mongodb'
import { quizAttempts, quizLikes, quizzes, type QuizDoc } from '../db'
import { fail, handle, json, readJson } from '../http'
import { uploadQuizCover } from '../images'
import { roundOwner } from '../profile'
import { QUIZ_LIMITS, readQuiz } from '../quizzes'

const LIMIT = 8 * 1024 * 1024

const view = (quiz: QuizDoc, plays = 0, likes = 0) => ({ ...quiz, _id: undefined, authorId: undefined, id: quiz._id!.toHexString(), plays, likes })

async function account(request: Request) {
  const owner = await roundOwner(request)
  return owner.guest ? null : owner.id
}

const idOf = (raw: unknown) => (typeof raw === 'string' && ObjectId.isValid(raw) ? new ObjectId(raw) : null)

export const GET = handle(async (request) => {
  const userId = await account(request)
  if (!userId) return fail(401, 'login')
  const collection = await quizzes()
  const id = idOf(new URL(request.url).searchParams.get('id'))
  if (id) {
    const quiz = await collection.findOne({ _id: id, authorId: userId })
    return quiz ? json({ quiz: view(quiz) }) : fail(404, 'not_found')
  }

  const list = await collection.find({ authorId: userId }, { sort: { updatedAt: -1 } }).toArray()
  const ids = list.map((quiz) => quiz._id!)
  const count = async (rows: { _id: unknown; count: number }[]) => new Map(rows.map((row) => [String(row._id), row.count]))
  const plays = await count(
    await (await quizAttempts()).aggregate<{ _id: unknown; count: number }>([{ $match: { quizId: { $in: ids }, finished: true } }, { $group: { _id: '$quizId', count: { $sum: 1 } } }]).toArray(),
  )
  const likes = await count(
    await (await quizLikes()).aggregate<{ _id: unknown; count: number }>([{ $match: { quizId: { $in: ids } } }, { $group: { _id: '$quizId', count: { $sum: 1 } } }]).toArray(),
  )
  return json({
    quizzes: list.map((quiz) => view(quiz, plays.get(quiz._id!.toHexString()) ?? 0, likes.get(quiz._id!.toHexString()) ?? 0)),
    limit: QUIZ_LIMITS.ownQuizzes,
  })
})

export const SAVE = handle(async (request) => {
  const userId = await account(request)
  if (!userId) return fail(401, 'login')
  const body = await readJson(request)
  const submit = body.submit === true
  const read = await readQuiz(body, !submit)
  if ('error' in read) return json({ error: read.error, at: read.at }, 400)

  const status = submit ? 'review' : 'draft'
  const fields = { ...read.quiz, status, official: false, note: '' } as const
  const collection = await quizzes()
  const now = new Date()
  const id = idOf(body.id)

  if (id) {
    const saved = await collection.findOneAndUpdate({ _id: id, authorId: userId }, { $set: { ...fields, updatedAt: now } }, { returnDocument: 'after' })
    if (!saved) return fail(404, 'not_found')
    await (await quizAttempts()).updateMany({ quizId: saved._id!, finished: false }, { $set: { answers: [] } })
    return json({ quiz: view(saved) })
  }

  if ((await collection.countDocuments({ authorId: userId })) >= QUIZ_LIMITS.ownQuizzes) return fail(409, 'too_many')
  const doc: QuizDoc = { ...fields, authorId: userId, createdAt: now, updatedAt: now }
  const { insertedId } = await collection.insertOne(doc)
  return json({ quiz: view({ ...doc, _id: insertedId }) })
})

export const DROP = handle(async (request) => {
  const userId = await account(request)
  if (!userId) return fail(401, 'login')
  const id = idOf((await readJson(request)).id)
  if (!id) return fail(400, 'bad_request')
  const { deletedCount } = await (await quizzes()).deleteOne({ _id: id, authorId: userId })
  if (!deletedCount) return fail(404, 'not_found')
  await (await quizAttempts()).deleteMany({ quizId: id })
  await (await quizLikes()).deleteMany({ quizId: id })
  return json({ ok: true })
})

type Upload = { size: number; arrayBuffer: () => Promise<ArrayBuffer> }

export const COVER = handle(async (request) => {
  if (!(await account(request))) return fail(401, 'login')
  const form = await request.formData().catch(() => null)
  const file = form?.get('file') as unknown as Upload | null
  if (!file || typeof file === 'string' || !file.size) return fail(400, 'no_file')
  if (file.size > LIMIT) return fail(413, 'too_large')
  return json(await uploadQuizCover(Buffer.from(await file.arrayBuffer()), form?.get('wide') === '1'))
})
