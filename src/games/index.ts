import { aot } from './aot'
import { berserk } from './berserk'
import { bleach } from './bleach'
import { dota } from './dota'
import { naruto } from './naruto'
import { tg } from './tg'
import type { Entity, Game, GameId } from './types'

export const GAMES = [naruto, aot, bleach, tg, berserk, dota] as unknown as Game<Entity>[]

export const gameById = (id: GameId) => GAMES.find((g) => g.id === id) ?? GAMES[0]
