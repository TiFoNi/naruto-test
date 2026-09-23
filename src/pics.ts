import { GAME_SPECS, type GameId } from './games/specs'

const local = import.meta.env.BASE_URL
const remote = import.meta.env.VITE_PICS_URL

const fullBase = remote ? `${remote.replace(/\/+$/, '')}/` : local

export const atlasUrl = (game: GameId) => `${local}${GAME_SPECS[game].images}/thumbs.webp`
export const fullUrl = (game: GameId, id: number) => `${fullBase}${GAME_SPECS[game].images}/full/${id}.webp`
