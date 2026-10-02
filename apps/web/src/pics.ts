import { GAME_SPECS, type GameId } from '@nanda/game'
import versions from '@nanda/game/data/versions.json'

const local = '/'
const remote = process.env.NEXT_PUBLIC_PICS_URL

const fullBase = remote ? `${remote.replace(/\/+$/, '')}/` : local

const build = process.env.NEXT_PUBLIC_PICS_VER

export const CARD = { width: 288, height: 384 }

export const MINI = { width: 168, height: 224 }

const worldVersion = (game: GameId) => (versions as Record<string, string>)[GAME_SPECS[game].images] ?? build

const tag = (game: GameId, version?: string) => {
  const stamp = version ?? worldVersion(game)
  return stamp ? `?v=${stamp}` : ''
}

export const atlasUrl = (game: GameId, version?: string) => `${fullBase}${GAME_SPECS[game].images}/thumbs.webp${tag(game, version)}`

export const fullUrl = (game: GameId, id: number, version?: string) =>
  `${fullBase}${GAME_SPECS[game].images}/full/${id}.webp${tag(game, version)}`
export const cardUrl = (game: GameId, id: number, version?: string) =>
  `${fullBase}${GAME_SPECS[game].images}/card/${id}.webp${tag(game, version)}`
export const miniUrl = (game: GameId, id: number, version?: string) =>
  `${fullBase}${GAME_SPECS[game].images}/mini/${id}.webp${tag(game, version)}`

export const avatarUrl = (id: string, version: string) => `${fullBase}avatars/${id}.webp?v=${version}`
