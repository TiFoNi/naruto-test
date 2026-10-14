'use client'

import { use } from 'react'
import Worlds from '@/src/Worlds'

export default function PlayerWorldsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <Worlds id={id} />
}
