import { judgeAll, type GameId } from '@nanda/game'
import type { Entity } from './games'

const sameEverywhere = (game: GameId, guess: Entity, answer: Entity) => {
  const judged = Object.values(judgeAll(game, guess, answer))
  return judged.length > 0 && judged.every((one) => one.verdict === 'correct')
}

export function twinsOf(game: GameId, list: Entity[], byId: Map<number, Entity>, answerId: number, guesses: number[]) {
  const answer = byId.get(answerId)
  if (!answer) return []

  const met = guesses.some((id) => {
    const guess = id !== answerId ? byId.get(id) : undefined
    return guess ? sameEverywhere(game, guess, answer) : false
  })
  if (!met) return []

  const seen = new Set(guesses)
  return list.filter((one) => one.id !== answerId && !seen.has(one.id) && sameEverywhere(game, one, answer)).map((one) => one.id)
}
