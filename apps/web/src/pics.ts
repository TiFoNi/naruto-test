import { GAME_SPECS, type GameId } from '@nanda/game'

const local = '/'
const remote = process.env.NEXT_PUBLIC_PICS_URL

const fullBase = remote ? `${remote.replace(/\/+$/, '')}/` : local

export const CARD = { width: 288, height: 384 }

export const MINI = { width: 168, height: 224 }

export const atlasUrl = (game: GameId) => `${local}${GAME_SPECS[game].images}/thumbs.webp`
const tag = (version?: string) => (version ? `?v=${version}` : '')

export const fullUrl = (game: GameId, id: number, version?: string) =>
  `${fullBase}${GAME_SPECS[game].images}/full/${id}.webp${tag(version)}`
export const cardUrl = (game: GameId, id: number, version?: string) =>
  `${fullBase}${GAME_SPECS[game].images}/card/${id}.webp${tag(version)}`
export const miniUrl = (game: GameId, id: number, version?: string) =>
  `${fullBase}${GAME_SPECS[game].images}/mini/${id}.webp${tag(version)}`
