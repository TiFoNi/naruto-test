export const ZOOM_LEVELS = [7, 5.1, 3.7, 2.6, 1.9, 1.4, 1]

export const levelAt = (index: number) => ZOOM_LEVELS[Math.min(index, ZOOM_LEVELS.length - 1)]
