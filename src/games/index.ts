import { aot } from './aot'
import { berserk } from './berserk'
import { bleach } from './bleach'
import { bluelock } from './bluelock'
import { dota } from './dota'
import { kny } from './kny'
import { naruto } from './naruto'
import { onepiece } from './onepiece'
import { tg } from './tg'
import type { Entity, Game, GameId } from './types'

export const GAMES = [naruto, onepiece, aot, bleach, kny, tg, berserk, bluelock, dota] as unknown as Game<Entity>[]

export const gameById = (id: GameId) => GAMES.find((g) => g.id === id) ?? GAMES[0]
