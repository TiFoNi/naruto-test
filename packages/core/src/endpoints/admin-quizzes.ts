import { ObjectId } from 'mongodb'
import { adminSession } from '../admin'
import { quizAttempts, quizzes, type QuizDoc } from '../db'
import { fail, handle, json, readJson } from '../http'
import { uploadQuizCover } from '../images'
import { readQuiz } from '../quizzes'

const LIMIT = 8 * 1024 * 1024

const missing = () => fail(404, 'not_found')

const full = (quiz: QuizDoc) => ({ ...quiz, _id: undefined, id: quiz._id!.toHexString() })

export const GET = handle(async (request) => {
  if (!(await adminSession(request))) return missing()
  const list = await (await quizzes()).find({}, { sort: { updatedAt: -1 } }).toArray()
  return json({ quizzes: list.map(full), pics: process.env.PICS_URL?.replace(/\/+$/, '') ?? '' })
})

export const SAVE = handle(async (request) => {
  if (!(await adminSession(request))) return missing()
  const body = await readJson(request)
  const read = await readQuiz(body)
  if ('error' in read) return json({ error: read.error, at: read.at }, 400)

  const collection = await quizzes()
  const now = new Date()
  if (typeof body.id === 'string' && ObjectId.isValid(body.id)) {
    const saved = await collection.findOneAndUpdate(
      { _id: new ObjectId(body.id) },
      { $set: { ...read.quiz, updatedAt: now } },
      { returnDocument: 'after' },
    )
    if (!saved) return missing()
    await (await quizAttempts()).updateMany({ quizId: saved._id!, finished: false }, { $set: { answers: [] } })
    return json({ quiz: full(saved) })
  }

  const doc: QuizDoc = { ...read.quiz, createdAt: now, updatedAt: now }
  const { insertedId } = await collection.insertOne(doc)
  return json({ quiz: full({ ...doc, _id: insertedId }) })
})

export const DROP = handle(async (request) => {
  if (!(await adminSession(request))) return missing()
  const body = await readJson(request)
  if (typeof body.id !== 'string' || !ObjectId.isValid(body.id)) return fail(400, 'bad_request')
  const id = new ObjectId(body.id)
  await (await quizzes()).deleteOne({ _id: id })
  await (await quizAttempts()).deleteMany({ quizId: id })
  return json({ ok: true })
})

type Upload = { size: number; arrayBuffer: () => Promise<ArrayBuffer> }

export const COVER = handle(async (request) => {
  if (!(await adminSession(request))) return missing()
  const form = await request.formData().catch(() => null)
  const file = form?.get('file') as unknown as Upload | null
  if (!file || typeof file === 'string' || !file.size) return fail(400, 'no_file')
  if (file.size > LIMIT) return fail(413, 'too_large')
  return json(await uploadQuizCover(Buffer.from(await file.arrayBuffer())))
})
