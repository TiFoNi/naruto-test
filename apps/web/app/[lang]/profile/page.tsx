'use client'

import Profile from '@/src/Profile'
import { useHref, useNavigate } from '@/src/router'

export default function ProfilePage() {
  const href = useHref()
  const navigate = useNavigate()
  return <Profile onBack={() => navigate(href.home)} />
}
