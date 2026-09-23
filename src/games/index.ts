import { aot } from './aot'
import { berserk } from './berserk'
import { bleach } from './bleach'
import { bc } from './bc'
import { dn } from './dn'
import { dota } from './dota'
import { hxh } from './hxh'
import { ff } from './ff'
import { jojo } from './jojo'
import { manga } from './manga'
import { se } from './se'
import { kny } from './kny'
import { mk } from './mk'
import { naruto } from './naruto'
import { onepiece } from './onepiece'
import { tg } from './tg'
import type { Entity, Game, GameId } from './types'

const ALL = [naruto, onepiece, aot, bleach, kny, tg, berserk, hxh, bc, jojo, se, ff, dn, dota, mk, manga] as unknown as Game<Entity>[]

export const GAMES = ALL.filter((g) => g.entities.some((e) => e.answer))

export const gameById = (id: GameId) => GAMES.find((g) => g.id === id) ?? GAMES[0]
