import { adminSession } from '../admin'
import { fail, handle, json, readJson } from '../http'
import { currentUser, unauthorized } from '../profile'
import { publishedQuiz } from '../quizzes'
import { commentPage, dropComment, findComment, markSpoiler, sendComment } from '../quiz-comments'

export const LIST = handle(async (request) => {
  const url = new URL(request.url)
  const quiz = await publishedQuiz(url.searchParams.get('id'))
  if (!quiz) return fail(404, 'not_found')
  const [found, admin] = await Promise.all([currentUser(request).catch(() => null), adminSession(request).catch(() => null)])
  const viewer = found?.doc._id ?? null
  const page = await commentPage(quiz, viewer, url.searchParams.get('before'))
  const moderator = !!admin || (!!viewer && !!quiz.authorId && quiz.authorId.equals(viewer))
  return json({ ...page, moderator })
})

export const SEND = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const body = await readJson(request)
  const quiz = await publishedQuiz(body.id)
  if (!quiz) return fail(404, 'not_found')
  const line = await sendComment(found.doc, quiz, body.text, body.spoiler, body.reply)
  if (line === 'empty') return fail(400, 'bad_request')
  if (line === 'muted') return fail(403, 'muted')
  if (line === 'too_fast') return fail(429, 'too_fast')
  return json({ comment: line })
})

export const EDIT = handle(async (request) => {
  const found = await currentUser(request)
  if (!found) return unauthorized()
  const body = await readJson(request)
  const quiz = await publishedQuiz(body.id)
  if (!quiz) return fail(404, 'not_found')
  const comment = await findComment(quiz, body.comment)
  if (!comment) return fail(404, 'not_found')

  const viewer = found.doc._id!
  const own = comment.userId.equals(viewer)
  const moderator = (!!quiz.authorId && quiz.authorId.equals(viewer)) || !!(await adminSession(request).catch(() => null))
  if (!own && !moderator) return fail(403, 'forbidden')

  if (body.drop === true) {
    await dropComment(comment)
    return json({ dropped: comment._id!.toHexString() })
  }
  if (typeof body.spoiler === 'boolean') {
    await markSpoiler(comment, body.spoiler)
    return json({ id: comment._id!.toHexString(), spoiler: body.spoiler })
  }
  return fail(400, 'bad_request')
})
