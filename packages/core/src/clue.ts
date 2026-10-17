import { randomInt } from 'node:crypto'
import { CLUE_WORD_MAX, cluePlan, clueSide, type GameId } from '@nanda/game'
import { gameData } from './games'
import type { DuelDoc, DuelPlayer } from './db'

export const OWN = 0
export const FOE = 1
export const GREY = 2
export const BLACK = 3

const shuffle = <T>(list: T[]) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const clueSizes = (pool: number) => [4, 5, 6].filter((side) => side * side <= pool)

export const teamKey = (team: number) => (team === 0 ? 0 : 1)

export const kindFor = (key: number, team: number) => (key > 1 ? key : key === teamKey(team) ? OWN : FOE)

export async function clueBoard(game: GameId, size: unknown, seen: number[] = []) {
  const pool = (await gameData(game)).pool
  const plan = cluePlan(size)
  if (pool.length < plan.cells) return null

  const fresh = pool.filter((one) => !seen.includes(one.id))
  const choices = fresh.length >= plan.cells ? fresh : pool
  const cards = shuffle(choices).slice(0, plan.cells).map((one) => one.id as number)

  const first = randomInt(2)
  const key = shuffle([
    ...Array.from({ length: plan.first }, () => first),
    ...Array.from({ length: plan.second }, () => 1 - first),
    ...Array.from({ length: plan.grey }, () => GREY),
    ...Array.from({ length: plan.black }, () => BLACK),
  ])

  return { cards, key, open: Array.from({ length: plan.cells }, () => -1), turn: first, word: null, count: 0, left: 0, hit: null }
}

export const leadOf = (duel: DuelDoc, team: number) =>
  duel.players.find((side) => (side.team ?? 0) === team && side.lead)

export const isLead = (duel: DuelDoc, side: DuelPlayer) => Boolean(side.lead)

export const sideLeft = (duel: DuelDoc, team: number) => {
  const board = duel.clue
  if (!board) return 0
  const want = teamKey(team)
  return board.key.reduce((sum, key, index) => (key === want && board.open[index] < 0 ? sum + 1 : sum), 0)
}

export const clueWinner = (duel: DuelDoc) => {
  const board = duel.clue
  if (!board) return null
  if (board.hit?.kind === BLACK) return 1 - (board.turn ?? 0)
  if (sideLeft(duel, 0) === 0) return 0
  if (sideLeft(duel, 1) === 0) return 1
  return null
}

export const cleanWord = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, CLUE_WORD_MAX) : ''

export const cleanCount = (value: unknown, cells: number) => {
  const asked = Math.floor(Number(value))
  return Number.isFinite(asked) ? Math.max(1, Math.min(asked, Math.max(1, cells - 1))) : 1
}

export const clueCells = (duel: DuelDoc) => cluePlan(clueSide(duel.size)).cells
