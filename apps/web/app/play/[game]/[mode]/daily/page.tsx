'use client'

import { use } from 'react'
import PlayView from '@/src/PlayView'

export default function PlayPage({ params }: { params: Promise<{ game: string; mode: string }> }) {
  const { game, mode } = use(params)
  return <PlayView game={game} mode={mode} daily={true} />
}
