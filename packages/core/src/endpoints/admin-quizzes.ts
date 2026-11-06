import { ObjectId } from 'mongodb'
import { adminSession } from '../admin'
import { quizAttempts, quizLikes, quizzes, users, type QuizDoc } from '../db'
import { dropQuizComments } from '../quiz-comments'
import { fail, handle, json, readJson } from '../http'
import { uploadQuizCover } from '../images'
import { quizAuthors, readQuiz } from '../quizzes'

const LIMIT = 8 * 1024 * 1024

const missing = () => fail(404, 'not_found')

const QUIZ_NEWS_KEEP = 10

async function tellRejected(quiz: QuizDoc) {
  if (!quiz.authorId || quiz.official) return
  const news = { id: new ObjectId().toHexString(), quizId: quiz._id!.toHexString(), title: quiz.title, note: quiz.note ?? '', at: new Date() }
  await (await users()).updateOne({ _id: quiz.authorId }, { $push: { quizNews: { $each: [news], $slice: -QUIZ_NEWS_KEEP } } })
}

const full = (quiz: QuizDoc, authors: Awaited<ReturnType<typeof quizAuthors>>) => ({
  ...quiz,
  _id: undefined,
  authorId: undefined,
  id: quiz._id!.toHexString(),
  author: quiz.authorId ? (authors.get(quiz.authorId.toHexString()) ?? null) : null,
})

const one = async (quiz: QuizDoc) => full(quiz, await quizAuthors([quiz]))

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return missing()
  const list = await (await quizzes()).find({ $or: [{ official: true }, { status: { $ne: 'draft' } }] }, { sort: { updatedAt: -1 } }).toArray()
  const authors = await quizAuthors(list)
  return json({ quizzes: list.map((quiz) => full(quiz, authors)), pics: process.env.PICS_URL?.replace(/\/+$/, '') ?? '' })
})

export const SAVE = handle(async (request) => {
  if (!(await adminSession(request))) return missing()
  const body = await readJson(request)
  const read = await readQuiz(body)
  if ('error' in read) return json({ error: read.error, at: read.at }, 400)

  const collection = await quizzes()
  const now = new Date()
  if (typeof body.id === 'string' && ObjectId.isValid(body.id)) {
    const { official: _official, ...fields } = read.quiz
    const before = await collection.findOne({ _id: new ObjectId(body.id) }, { projection: { status: 1 } })
    const saved = await collection.findOneAndUpdate({ _id: new ObjectId(body.id) }, { $set: { ...fields, updatedAt: now } }, { returnDocument: 'after' })
    if (!saved) return missing()
    if (saved.status === 'rejected' && before?.status !== 'rejected') await tellRejected(saved)
    await (await quizAttempts()).updateMany({ quizId: saved._id!, finished: false }, { $set: { answers: [] } })
    return json({ quiz: await one(saved) })
  }

  const doc: QuizDoc = { ...read.quiz, createdAt: now, updatedAt: now }
  const { insertedId } = await collection.insertOne(doc)
  return json({ quiz: await one({ ...doc, _id: insertedId }) })
})

export const DROP = handle(async (request) => {
  if (!(await adminSession(request))) return missing()
  const body = await readJson(request)
  if (typeof body.id !== 'string' || !ObjectId.isValid(body.id)) return fail(400, 'bad_request')
  const id = new ObjectId(body.id)
  await (await quizzes()).deleteOne({ _id: id })
  await (await quizAttempts()).deleteMany({ quizId: id })
  await (await quizLikes()).deleteMany({ quizId: id })
  await dropQuizComments(id)
  return json({ ok: true })
})

type Upload = { size: number; arrayBuffer: () => Promise<ArrayBuffer> }

export const COVER = handle(async (request) => {
  if (!(await adminSession(request))) return missing()
  const form = await request.formData().catch(() => null)
  const file = form?.get('file') as unknown as Upload | null
  if (!file || typeof file === 'string' || !file.size) return fail(400, 'no_file')
  if (file.size > LIMIT) return fail(413, 'too_large')
  return json(await uploadQuizCover(Buffer.from(await file.arrayBuffer()), form?.get('wide') === '1'))
})
