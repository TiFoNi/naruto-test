import { randomInt } from 'node:crypto'
import type { ObjectId } from 'mongodb'
import { hasMode, type GameId, type ModeId } from '@nanda/game'
import { challenges, users, type ChallengeDoc, type UserDoc } from './db'
import { modeFits, roundExtra } from './extra'
import { gameData, isGame, isMode } from './games'
import { defaultNickname } from './profile'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 7

const newCode = () => Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

export const isCode = (value: unknown): value is string => typeof value === 'string' && new RegExp(`^[A-Z0-9]{${CODE_LENGTH}}$`).test(value)

const MIN_GAP_MS = 3_000
const KEEP_PER_AUTHOR = 50

export async function createChallenge(author: UserDoc, game: unknown, mode: unknown, answerId: unknown) {
  if (!isGame(game) || !isMode(mode) || !hasMode(game, mode)) return 'bad_request'
  const { byId } = await gameData(game)
  if (typeof answerId !== 'number' || !byId.has(answerId) || !modeFits(mode, answerId)) return 'bad_request'

  const extra = await roundExtra(game, mode, answerId)
  if (mode === 'page' && !extra) return 'bad_request'

  const now = new Date()
  const free = await (await users()).findOneAndUpdate(
    {
      _id: author._id!,
      $or: [
        { lastChallengeAt: { $exists: false } },
        { lastChallengeAt: null },
        { lastChallengeAt: { $lte: new Date(now.getTime() - MIN_GAP_MS) } },
      ],
    },
    { $set: { lastChallengeAt: now } },
  )
  if (!free) return 'too_fast'

  const collection = await challenges()
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc: ChallengeDoc = {
      code: newCode(),
      authorId: author._id!,
      author: author.nickname ?? defaultNickname(author.username),
      game,
      mode,
      answerId,
      ...(extra ? { extra } : {}),
      solves: [],
      createdAt: now,
    }
    try {
      await collection.insertOne(doc)
      await trimAuthor(author._id!)
      return doc
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error
    }
  }
  return 'server'
}

async function trimAuthor(authorId: ObjectId) {
  const collection = await challenges()
  const extra = await collection
    .find({ authorId }, { projection: { _id: 1 } })
    .sort({ createdAt: -1 })
    .skip(KEEP_PER_AUTHOR)
    .toArray()
  if (extra.length) await collection.deleteMany({ _id: { $in: extra.map((one) => one._id) } })
}

export async function findChallenge(code: string) {
  return (await challenges()).findOne({ code })
}

export function challengeView(doc: ChallengeDoc, viewerId: ObjectId) {
  const mine = doc.authorId.equals(viewerId)
  const solve = doc.solves.find((s) => s.userId.equals(viewerId))
  const over = mine || Boolean(solve)
  return {
    code: doc.code,
    game: doc.game as GameId,
    mode: doc.mode as ModeId,
    author: defaultNickname(doc.author),
    mine,
    answerId: over ? doc.answerId : undefined,
    played: doc.solves.length,
    solves: over
      ? doc.solves.map((s) => ({ nickname: defaultNickname(s.nickname), guesses: s.guesses, guessIds: s.guessIds ?? [], solved: s.solved }))
      : [],
  }
}

export async function recordSolve(
  code: string,
  user: { id: ObjectId; nickname: string },
  guesses: number,
  guessIds: number[],
  solved: boolean,
) {
  const collection = await challenges()
  await collection.updateOne({ code, 'solves.userId': { $ne: user.id } }, {
    $push: { solves: { userId: user.id, nickname: user.nickname, guesses, guessIds, solved, at: new Date() } },
  })
}
