export type RoundPush = { id: string; device: string | null }

const listeners = new Set<(push: RoundPush) => void>()

export const pushRound = (push: unknown) => {
  if (!push || typeof (push as RoundPush).id !== 'string') return
  for (const listener of listeners) listener(push as RoundPush)
}

export const watchRoundPush = (listener: (push: RoundPush) => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export type PlayPush = { device: string | null }

const players = new Set<(push: PlayPush) => void>()

export const pushPlay = (push: unknown) => {
  if (!push || typeof push !== 'object') return
  for (const listener of players) listener(push as PlayPush)
}

export const watchPlayPush = (listener: (push: PlayPush) => void) => {
  players.add(listener)
  return () => {
    players.delete(listener)
  }
}
