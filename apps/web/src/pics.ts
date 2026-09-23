import { GAME_SPECS, type GameId } from '@nanda/game'

const local = '/'
const remote = process.env.NEXT_PUBLIC_PICS_URL

const fullBase = remote ? `${remote.replace(/\/+$/, '')}/` : local

export const atlasUrl = (game: GameId) => `${local}${GAME_SPECS[game].images}/thumbs.webp`
export const fullUrl = (game: GameId, id: number) => `${fullBase}${GAME_SPECS[game].images}/full/${id}.webp`
export const cardUrl = (game: GameId, id: number) => `${fullBase}${GAME_SPECS[game].images}/card/${id}.webp`
