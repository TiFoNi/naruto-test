import { aot } from './aot'
import { berserk } from './berserk'
import { bleach } from './bleach'
import { bc } from './bc'
import { dota } from './dota'
import { hxh } from './hxh'
import { jojo } from './jojo'
import { kny } from './kny'
import { mk } from './mk'
import { naruto } from './naruto'
import { onepiece } from './onepiece'
import { tg } from './tg'
import type { Entity, Game, GameId } from './types'

export const GAMES = [naruto, onepiece, aot, bleach, kny, tg, berserk, hxh, bc, jojo, dota, mk] as unknown as Game<Entity>[]

export const gameById = (id: GameId) => GAMES.find((g) => g.id === id) ?? GAMES[0]
