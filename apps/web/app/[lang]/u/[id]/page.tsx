'use client'

import { use } from 'react'
import Profile from '@/src/Profile'
import '@/src/styles/dex.css'

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <Profile id={id} />
}
