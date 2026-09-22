import { dota } from './dota'
import { naruto } from './naruto'
import type { Entity, Game, GameId } from './types'

export const GAMES = [naruto, dota] as unknown as Game<Entity>[]

export const gameById = (id: GameId) => GAMES.find((g) => g.id === id) ?? GAMES[0]
