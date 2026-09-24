'use client'

import { use } from 'react'
import BoardView from '@/src/BoardView'

export default function LeaderboardPage({ params }: { params: Promise<{ game: string; mode: string }> }) {
  const { game, mode } = use(params)
  return <BoardView game={game} mode={mode} />
}
