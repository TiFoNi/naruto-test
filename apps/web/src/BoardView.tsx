'use client'

import Leaderboard from './Leaderboard'
import { GAMES } from './games'
import type { GameId } from './games/types'
import type { ModeId } from './modes'

export default function BoardView({ game: gameId, mode: modeId, daily }: { game: string; mode: string; daily: boolean }) {
  const game = GAMES.find((g) => g.id === (gameId as GameId)) ?? GAMES[0]
  const mode = (game.modes.includes(modeId as ModeId) ? modeId : game.modes[0]) as ModeId
  return <Leaderboard gameId={game.id} mode={mode} daily={daily} />
}
