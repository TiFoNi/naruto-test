import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { applyResult, emptyStats, type Stats } from './stats'

export type User = { id: string; username: string; nickname: string }

type Profile = { user: User; stats: Record<string, Stats> }

type Mode = 'login' | 'register'

type ApiData = { user?: User; stats?: unknown; error?: string; key?: string }

type AuthState = {
  user: User | null
  stats: Record<string, Stats>
  loading: boolean
  submit: (mode: Mode, username: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  record: (game: string, mode: string, won: boolean, guesses: number) => void
  resetStats: () => Promise<string | null>
  setNickname: (nickname: string) => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

async function call(path: string, body?: unknown) {
  const response = await fetch(`/api/${path}`, {
    signal: AbortSignal.timeout(15000),
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
  const data = (await response.json().catch(() => ({}))) as ApiData
  return { ok: response.ok, status: response.status, data }
}

export const statsKey = (game: string, mode: string) => `${game}_${mode}`

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const accept = (data: ApiData) => {
    if (data.user) setProfile({ user: data.user, stats: (data.stats as Record<string, Stats>) ?? {} })
  }

  useEffect(() => {
    call('auth/me')
      .then(({ ok, data }) => (ok && data.user ? accept(data) : setProfile(null)))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [])

  const submit = useCallback(async (mode: Mode, username: string, password: string) => {
    try {
      const { ok, data } = await call(`auth/${mode}`, { username, password })
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
    await call('auth/logout', {}).catch(() => null)
    setProfile(null)
  }, [])

  const record = useCallback((game: string, mode: string, won: boolean, guesses: number) => {
    const key = statsKey(game, mode)
    setProfile((p) => p && { ...p, stats: { ...p.stats, [key]: applyResult(p.stats[key] ?? emptyStats, won, guesses) } })
    const resync = () =>
      call('auth/me')
        .then(({ ok, data }) => (ok && data.user ? accept(data) : setProfile(null)))
        .catch(() => null)
    call('stats/record', { game, mode, won, guesses })
      .then(({ ok, status, data }) => {
        if (ok && data.key) setProfile((p) => p && { ...p, stats: { ...p.stats, [data.key!]: data.stats as Stats } })
        else if (status === 401) setProfile(null)
        else resync()
      })
      .catch(resync)
  }, [])

  const resetStats = useCallback(async () => {
    try {
      const { ok, data } = await call('stats/reset', {})
      if (!ok) return data.error ?? 'server'
      accept(data)
      return null
    } catch {
      return 'network'
    }
  }, [])

  const setNickname = useCallback(async (nickname: string) => {
    try {
      const { ok, data } = await call('profile/nickname', { nickname })
      if (!ok) return data.error ?? 'server'
      accept(data)
      return null
    } catch {
      return 'network'
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ user: profile?.user ?? null, stats: profile?.stats ?? {}, loading, submit, logout, record, resetStats, setNickname }}
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
