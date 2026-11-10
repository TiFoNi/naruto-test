import { aot } from './aot'
import { berserk } from './berserk'
import { bleach } from './bleach'
import { brawl } from './brawl'
import { bc } from './bc'
import { csm } from './csm'
import { mushoku } from './mushoku'
import { kuroko } from './kuroko'
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
import { HIDDEN_GAMES } from '@nanda/game'
import type { Entity, Game, GameId } from './types'

const ALL = [tunes, shots, naruto, onepiece, aot, bleach, kny, mha, jjk, csm, mushoku, kuroko, tg, berserk, hxh, bc, jojo, se, ff, dn, avatar, marvel, dota, genshin, brawl, mk, manga, football] as unknown as Game<Entity>[]

const open = (admin: boolean) => ALL.filter((game) => admin || !HIDDEN_GAMES.includes(game.id))

export const GAMES = open(false)

export const ALL_GAMES = open(true)

export function showHiddenGames(admin: boolean) {
  const next = open(admin)
  if (next.length !== GAMES.length) GAMES.splice(0, GAMES.length, ...next)
}

export const BOARD_START = { game: 'shots', mode: 'shot' } as const

export const gameById = (id: GameId) => ALL.find((g) => g.id === id) ?? ALL[0]
