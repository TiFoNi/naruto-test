import { ZOOM_LEVELS } from '@nanda/game'

export { ZOOM_LEVELS }

export const levelAt = (index: number) => ZOOM_LEVELS[Math.min(index, ZOOM_LEVELS.length - 1)]
