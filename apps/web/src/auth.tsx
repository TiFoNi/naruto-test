import { authClient } from './authClient'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { statsKey } from '@nanda/game'
import type { Stats } from './stats'

export type User = { id: string; username: string; nickname: string; level: number; xp: number }

export type DuelRecord = { played: number; wins: number; losses: number; draws: number }

export type ChallengeRecord = { solved: number }

type Profile = { user: User; stats: Record<string, Stats>; duels: DuelRecord; challenges: ChallengeRecord }


type ApiData = { user?: User; stats?: unknown; duels?: DuelRecord; challenges?: ChallengeRecord; error?: string; key?: string }

type AuthState = {
  user: User | null
  stats: Record<string, Stats>
  duels: DuelRecord
  challenges: ChallengeRecord
  loading: boolean
  logout: () => Promise<void>
  setStats: (key: string, stats: Stats) => void
  refresh: () => Promise<void>
  expire: () => void
  resetStats: () => Promise<string | null>
  setNickname: (nickname: string) => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

const EMPTY_DUELS: DuelRecord = { played: 0, wins: 0, losses: 0, draws: 0 }
const EMPTY_CHALLENGES: ChallengeRecord = { solved: 0 }

const call = (path: string, body?: unknown) => api<ApiData>(path, body)

export { statsKey }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const accept = (data: ApiData) => {
    if (data.user)
      setProfile({
        user: data.user,
        stats: (data.stats as Record<string, Stats>) ?? {},
        duels: data.duels ?? EMPTY_DUELS,
        challenges: data.challenges ?? EMPTY_CHALLENGES,
      })
  }

  useEffect(() => {
    call('me')
      .then(({ ok, data }) => (ok && data.user ? accept(data) : setProfile(null)))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [])

  const refresh = useCallback(async () => {
    const { ok, data } = await call('me').catch(() => ({ ok: false, data: {} as ApiData }))
    if (ok && data.user) accept(data)
  }, [])

  const logout = useCallback(async () => {
    await authClient.signOut().catch(() => null)
    setProfile(null)
  }, [])

  const setStats = useCallback((key: string, stats: Stats) => {
    setProfile((p) => p && { ...p, stats: { ...p.stats, [key]: stats } })
  }, [])

  const expire = useCallback(() => setProfile(null), [])

  const resetStats = useCallback(async () => {
    try {
      const { ok, data } = await call('profile', { action: 'reset' })
      if (!ok) return data.error ?? 'server'
      accept(data)
      return null
    } catch {
      return 'network'
    }
  }, [])

  const setNickname = useCallback(async (nickname: string) => {
    try {
      const { ok, data } = await call('profile', { action: 'nickname', nickname })
      if (!ok) return data.error ?? 'server'
      accept(data)
      return null
    } catch {
      return 'network'
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ user: profile?.user ?? null, stats: profile?.stats ?? {}, duels: profile?.duels ?? EMPTY_DUELS,
        challenges: profile?.challenges ?? EMPTY_CHALLENGES, loading, logout, setStats, expire, resetStats, setNickname, refresh }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
