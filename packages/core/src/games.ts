import { GAME_SPECS, MODE_IDS, type GameId, type ModeId } from '@nanda/game'
import aot from '@nanda/game/data/aot.json'
import avatar from '@nanda/game/data/avatar.json'
import bc from '@nanda/game/data/bc.json'
import berserk from '@nanda/game/data/berserk.json'
import bleach from '@nanda/game/data/bleach.json'
import characters from '@nanda/game/data/characters.json'
import dn from '@nanda/game/data/dn.json'
import dota from '@nanda/game/data/dota.json'
import ff from '@nanda/game/data/ff.json'
import hxh from '@nanda/game/data/hxh.json'
import jojo from '@nanda/game/data/jojo.json'
import kny from '@nanda/game/data/kny.json'
import manga from '@nanda/game/data/manga.json'
import mk from '@nanda/game/data/mk.json'
import onepiece from '@nanda/game/data/onepiece.json'
import se from '@nanda/game/data/se.json'
import tg from '@nanda/game/data/tg.json'

export type Entity = Record<string, unknown> & { id: number; answer: boolean }

type GameData = { byId: Map<number, Entity>; pool: Entity[] }

const FILES: Record<string, Entity[]> = {
  'aot': aot as Entity[],
  'avatar': avatar as Entity[],
  'bc': bc as Entity[],
  'berserk': berserk as Entity[],
  'bleach': bleach as Entity[],
  'characters': characters as Entity[],
  'dn': dn as Entity[],
  'dota': dota as Entity[],
  'ff': ff as Entity[],
  'hxh': hxh as Entity[],
  'jojo': jojo as Entity[],
  'kny': kny as Entity[],
  'manga': manga as Entity[],
  'mk': mk as Entity[],
  'onepiece': onepiece as Entity[],
  'se': se as Entity[],
  'tg': tg as Entity[],
}

const cache = new Map<GameId, GameData>()

export const isGame = (value: unknown): value is GameId => typeof value === 'string' && value in GAME_SPECS
export const knows = (game: GameId, id: number) => gameData(game).byId.has(id)

export const isMode = (value: unknown): value is ModeId => typeof value === 'string' && (MODE_IDS as string[]).includes(value)

export function gameData(game: GameId): GameData {
  const cached = cache.get(game)
  if (cached) return cached

  const list = FILES[GAME_SPECS[game].data]
  const data = { byId: new Map(list.map((e) => [e.id, e])), pool: list.filter((e) => e.answer) }
  cache.set(game, data)
  return data
}
