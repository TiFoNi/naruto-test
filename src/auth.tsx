import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { statsKey } from './games/specs'
import type { Stats } from './stats'
import { RATING_START } from './rating'

export type User = { id: string; username: string; nickname: string }

export type DuelRecord = { rating: number; played: number; wins: number; losses: number; draws: number }

export type ChallengeRecord = { solved: number }

type Profile = { user: User; stats: Record<string, Stats>; duels: DuelRecord; challenges: ChallengeRecord }

type Mode = 'login' | 'register'

type ApiData = { user?: User; stats?: unknown; duels?: DuelRecord; challenges?: ChallengeRecord; error?: string; key?: string }

type AuthState = {
  user: User | null
  stats: Record<string, Stats>
  duels: DuelRecord
  challenges: ChallengeRecord
  loading: boolean
  submit: (mode: Mode, username: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  setStats: (key: string, stats: Stats) => void
  refresh: () => Promise<void>
  expire: () => void
  resetStats: () => Promise<string | null>
  setNickname: (nickname: string) => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

const EMPTY_DUELS: DuelRecord = { rating: RATING_START, played: 0, wins: 0, losses: 0, draws: 0 }
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
    call('auth')
      .then(({ ok, data }) => (ok && data.user ? accept(data) : setProfile(null)))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [])

  const refresh = useCallback(async () => {
    const { ok, data } = await call('auth').catch(() => ({ ok: false, data: {} as ApiData }))
    if (ok && data.user) accept(data)
  }, [])

  const submit = useCallback(async (mode: Mode, username: string, password: string) => {
    try {
      const { ok, data } = await call('auth', { action: mode, username, password })
      if (ok && data.user) {
        accept(data)
        return null
      }
      return data.error ?? 'server'
    } catch {
      return 'network'
    }
  }, [])

  const logout = useCallback(async () => {
    await call('auth', { action: 'logout' }).catch(() => null)
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
        challenges: profile?.challenges ?? EMPTY_CHALLENGES, loading, submit, logout, setStats, expire, resetStats, setNickname, refresh }}
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
