'use client'

import { use } from 'react'
import ChallengeRoom from '@/src/ChallengeRoom'

export default function ChallengePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  return <ChallengeRoom code={code.toUpperCase()} />
}
