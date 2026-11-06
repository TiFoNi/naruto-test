import { ObjectId } from 'mongodb'
import { REPLY_SNIPPET, freshFaces, tidy } from './chat'
import { quizComments, users, type ChatReply, type QuizCommentDoc, type QuizDoc, type UserDoc } from './db'
import { sendPush, type PushLang } from './push'

export const COMMENT_MAX = 600
const GAP_MS = 5000
const PER_MINUTE = 6
const PAGE = 30
const NEWS_KEEP = 10

export type CommentLine = {
  id: string
  userId: string
  nickname: string
  tag?: string
  avatar: string | null
  frame: string | null
  title: string | null
  nickTone: string | null
  text: string
  spoiler: boolean
  at: number
  author: boolean
  mine: boolean
  reply?: { id: string; userId: string; nickname: string; text: string; spoiler: boolean }
}

const PUSH_TEXT: Record<PushLang, { comment: string; reply: string }> = {
  ru: { comment: 'прокомментировал твой тест', reply: 'ответил на твой комментарий' },
  uk: { comment: 'прокоментував твій тест', reply: 'відповів на твій коментар' },
  en: { comment: 'commented on your quiz', reply: 'replied to your comment' },
}

export const lineOf = (doc: QuizCommentDoc, quiz: QuizDoc, viewer: ObjectId | null, veiled: Set<string>): CommentLine => ({
  id: doc._id!.toHexString(),
  userId: doc.userId.toHexString(),
  nickname: doc.nickname,
  ...(doc.tag ? { tag: doc.tag } : {}),
  avatar: doc.avatar ?? null,
  frame: doc.frame ?? null,
  title: doc.title ?? null,
  nickTone: doc.nickTone ?? null,
  text: doc.text,
  spoiler: doc.spoiler,
  at: doc.at.getTime(),
  author: !!quiz.authorId && quiz.authorId.equals(doc.userId),
  mine: !!viewer && viewer.equals(doc.userId),
  ...(doc.reply
    ? {
        reply: {
          id: doc.reply.id.toHexString(),
          userId: doc.reply.userId.toHexString(),
          nickname: doc.reply.nickname,
          text: doc.reply.text,
          spoiler: veiled.has(doc.reply.id.toHexString()),
        },
      }
    : {}),
})

export async function commentPage(quiz: QuizDoc, viewer: ObjectId | null, before?: string | null) {
  const collection = await quizComments()
  const older = before && ObjectId.isValid(before) ? { _id: { $lt: new ObjectId(before) } } : {}
  const [found, total] = await Promise.all([
    collection.find({ quizId: quiz._id!, hidden: { $ne: true }, ...older }, { sort: { _id: -1 }, limit: PAGE + 1 }).toArray(),
    collection.countDocuments({ quizId: quiz._id!, hidden: { $ne: true } }),
  ])
  const page = found.slice(0, PAGE)
  const quoted = [...new Set(page.filter((doc) => doc.reply).map((doc) => doc.reply!.id.toHexString()))].map((id) => new ObjectId(id))
  const [faces, spoilers] = await Promise.all([
    freshFaces(page),
    quoted.length ? collection.find({ _id: { $in: quoted }, spoiler: true }, { projection: { _id: 1 } }).toArray() : Promise.resolve([]),
  ])
  const veiled = new Set(spoilers.map((doc) => doc._id!.toHexString()))
  const lines = page.map((doc) => {
    const now = faces.get(doc.userId.toHexString())
    const fresh = now
      ? {
          ...doc,
          nickname: now.nickname ?? doc.nickname,
          tag: now.tag ?? doc.tag,
          avatar: now.avatar ?? null,
          frame: now.frame ?? null,
          title: now.title ?? null,
          nickTone: now.nickTone ?? null,
        }
      : doc
    return lineOf(fresh, quiz, viewer, veiled)
  })
  return { comments: lines, more: found.length > PAGE, total }
}

export async function commentCounts(ids: ObjectId[]) {
  if (!ids.length) return new Map<string, number>()
  const rows = await (
    await quizComments()
  )
    .aggregate<{ _id: ObjectId; count: number }>([
      { $match: { quizId: { $in: ids }, hidden: { $ne: true } } },
      { $group: { _id: '$quizId', count: { $sum: 1 } } },
    ])
    .toArray()
  return new Map(rows.map((row) => [row._id.toHexString(), row.count]))
}

async function readReply(quiz: QuizDoc, asked: unknown): Promise<{ reply: ChatReply; spoiler: boolean } | null> {
  if (typeof asked !== 'string' || !ObjectId.isValid(asked)) return null
  const found = await (
    await quizComments()
  ).findOne({ _id: new ObjectId(asked), quizId: quiz._id!, hidden: { $ne: true } }, { projection: { userId: 1, nickname: 1, text: 1, spoiler: 1 } })
  return found
    ? { reply: { id: found._id!, userId: found.userId, nickname: found.nickname, text: found.text.slice(0, REPLY_SNIPPET) }, spoiler: found.spoiler }
    : null
}

async function tell(target: ObjectId, doc: UserDoc, quiz: QuizDoc, line: CommentLine, reply: boolean) {
  const from = doc.nickname ?? doc.username
  const news = {
    id: line.id,
    quizId: quiz._id!.toHexString(),
    game: quiz.game,
    title: quiz.title,
    fromId: doc._id!.toHexString(),
    from,
    text: line.spoiler ? '' : line.text.slice(0, 160),
    at: new Date(),
    ...(reply ? { reply: true } : {}),
  }
  const person = await (
    await users()
  ).findOneAndUpdate({ _id: target }, { $push: { commentNews: { $each: [news], $slice: -NEWS_KEEP } } }, { projection: { mentionPush: 1 } })
  if (person && person.mentionPush !== false)
    await sendPush(target, (lang) => ({
      title: `${from} ${reply ? PUSH_TEXT[lang].reply : PUSH_TEXT[lang].comment}`,
      body: line.spoiler ? quiz.title : line.text.slice(0, 140),
      url: `/${lang}/play/${quiz.game}/tests/${quiz._id!.toHexString()}`,
      tag: 'comment',
    }))
}

export type CommentFail = 'empty' | 'muted' | 'too_fast'

export async function sendComment(doc: UserDoc, quiz: QuizDoc, raw: unknown, spoiler: unknown, replyTo: unknown): Promise<CommentLine | CommentFail> {
  const text = tidy(raw, COMMENT_MAX)
  if (!text) return 'empty'
  if (doc.chatMutedUntil && doc.chatMutedUntil.getTime() > Date.now()) return 'muted'

  const collection = await quizComments()
  const userId = doc._id!
  const [last, lately] = await Promise.all([
    collection.findOne({ userId }, { sort: { _id: -1 }, projection: { at: 1, text: 1 } }),
    collection.countDocuments({ userId, at: { $gt: new Date(Date.now() - 60_000) } }),
  ])
  if (lately >= PER_MINUTE) return 'too_fast'
  if (last && Date.now() - last.at.getTime() < GAP_MS) return 'too_fast'
  if (last && last.text === text && Date.now() - last.at.getTime() < 10 * 60_000) return 'too_fast'

  const comment: QuizCommentDoc = {
    quizId: quiz._id!,
    userId,
    nickname: doc.nickname ?? doc.username,
    ...(doc.tag ? { tag: doc.tag } : {}),
    avatar: doc.avatar ?? null,
    frame: doc.frame ?? null,
    title: doc.title ?? null,
    nickTone: doc.nickTone ?? null,
    text,
    spoiler: spoiler === true,
    at: new Date(),
  }
  const quote = await readReply(quiz, replyTo)
  const reply = quote?.reply ?? null
  if (reply) comment.reply = reply
  const saved = await collection.insertOne(comment)
  const line = lineOf({ ...comment, _id: saved.insertedId }, quiz, userId, new Set(quote?.spoiler ? [reply!.id.toHexString()] : []))

  const author = quiz.authorId && !quiz.authorId.equals(userId) ? quiz.authorId : null
  const answered = reply && !reply.userId.equals(userId) ? reply.userId : null
  if (answered) void tell(answered, doc, quiz, line, true).catch(() => undefined)
  if (author && !(answered && author.equals(answered))) void tell(author, doc, quiz, line, false).catch(() => undefined)
  return line
}

export async function findComment(quiz: QuizDoc, id: unknown) {
  if (typeof id !== 'string' || !ObjectId.isValid(id)) return null
  return (await quizComments()).findOne({ _id: new ObjectId(id), quizId: quiz._id!, hidden: { $ne: true } })
}

export async function dropComment(comment: QuizCommentDoc) {
  await (await quizComments()).updateOne({ _id: comment._id! }, { $set: { hidden: true } })
}

export async function markSpoiler(comment: QuizCommentDoc, on: boolean) {
  await (await quizComments()).updateOne({ _id: comment._id! }, { $set: { spoiler: on } })
}

export async function dropQuizComments(quizId: ObjectId) {
  await (await quizComments()).deleteMany({ quizId })
}
