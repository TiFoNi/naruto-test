import { randomInt } from 'node:crypto'
import type { ObjectId } from 'mongodb'
import { hasMode, type GameId, type ModeId } from '@nanda/game'
import { challenges, type ChallengeDoc, type UserDoc } from './db'
import { roundExtra } from './extra'
import { gameData, isGame, isMode } from './games'
import { defaultNickname } from './profile'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 7

const newCode = () => Array.from({ length: CODE_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

export const isCode = (value: unknown): value is string => typeof value === 'string' && new RegExp(`^[A-Z0-9]{${CODE_LENGTH}}$`).test(value)

export async function createChallenge(author: UserDoc, game: unknown, mode: unknown, answerId: unknown) {
  if (!isGame(game) || !isMode(mode) || !hasMode(game, mode)) return 'bad_request'
  const { byId } = gameData(game)
  if (typeof answerId !== 'number' || !byId.has(answerId)) return 'bad_request'

  const extra = roundExtra(game, mode, answerId)
  if (mode === 'page' && !extra) return 'bad_request'

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
      createdAt: new Date(),
    }
    try {
      await collection.insertOne(doc)
      return doc
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error
    }
  }
  return 'server'
}

export async function findChallenge(code: string) {
  return (await challenges()).findOne({ code })
}

export function challengeView(doc: ChallengeDoc, viewerId: ObjectId) {
  const mine = doc.authorId.equals(viewerId)
  const solve = doc.solves.find((s) => s.userId.equals(viewerId))
  return {
    code: doc.code,
    game: doc.game as GameId,
    mode: doc.mode as ModeId,
    author: defaultNickname(doc.author),
    mine,
    answerId: mine || solve ? doc.answerId : undefined,
    solves: doc.solves.map((s) => ({ nickname: defaultNickname(s.nickname), guesses: s.guesses, guessIds: s.guessIds ?? [], solved: s.solved })),
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
