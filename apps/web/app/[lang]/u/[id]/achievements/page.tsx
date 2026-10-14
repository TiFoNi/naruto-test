'use client'

import { use } from 'react'
import Achievements from '@/src/Achievements'

export default function PlayerAwardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <Achievements id={id} />
}
