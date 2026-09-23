'use client'

import Profile from '@/src/Profile'
import { href, useNavigate } from '@/src/router'

export default function ProfilePage() {
  const navigate = useNavigate()
  return <Profile onBack={() => navigate(href.home)} />
}
