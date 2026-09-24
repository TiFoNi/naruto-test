'use client'

import { use } from 'react'
import DuelRoom from '@/src/DuelRoom'

export default function DuelPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  return <DuelRoom code={code.toUpperCase()} />
}
