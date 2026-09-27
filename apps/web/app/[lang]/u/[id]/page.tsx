'use client'

import { use } from 'react'
import Profile from '@/src/Profile'
import { useHref, useNavigate } from '@/src/router'

export default function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const href = useHref()
  const navigate = useNavigate()
  return <Profile id={id} onBack={() => navigate(href.board)} />
}
