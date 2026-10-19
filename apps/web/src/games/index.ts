import { aot } from './aot'
import { berserk } from './berserk'
import { bleach } from './bleach'
import { bc } from './bc'
import { csm } from './csm'
import { avatar } from './avatar'
import { dn } from './dn'
import { dota } from './dota'
import { genshin } from './genshin'
import { mha } from './mha'
import { hxh } from './hxh'
import { ff } from './ff'
import { football } from './football'
import { jjk } from './jjk'
import { jojo } from './jojo'
import { manga } from './manga'
import { marvel } from './marvel'
import { se } from './se'
import { kny } from './kny'
import { mk } from './mk'
import { naruto } from './naruto'
import { onepiece } from './onepiece'
import { shots } from './shots'
import { tunes } from './tunes'
import { tg } from './tg'
import type { Entity, Game, GameId } from './types'

const ALL = [tunes, shots, naruto, onepiece, aot, bleach, kny, mha, jjk, csm, tg, berserk, hxh, bc, jojo, se, ff, dn, avatar, marvel, dota, genshin, mk, manga, football] as unknown as Game<Entity>[]

export const GAMES = ALL

export const BOARD_START = { game: 'shots', mode: 'shot' } as const

export const gameById = (id: GameId) => GAMES.find((g) => g.id === id) ?? GAMES[0]
