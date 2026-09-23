// Duel rating: one shared number across every game and mode.
export const RATING_START = 1000
export const RATING_STEP = 20
export const RATING_FLOOR = 0

// Ranked duels are built but not open yet: flip this to true to switch them on.
// The server honours it too, so a hand-made request cannot create a ranked room meanwhile.
export const RANKED_ENABLED = false

export const ratingOf = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : RATING_START)
