'use client'

import { useSyncExternalStore } from 'react'
import { api } from './api'

export type TalkLine = {
  id: string
  userId: string
  nickname: string
  tag?: string
  avatar?: string | null
  frame?: string | null
  title?: string | null
  nickTone?: string | null
  text: string
  at: number
}

export type TalkResult = 'ok' | 'muted' | 'too_fast' | 'failed'

export type DuelTalk = {
  code: string
  lines: TalkLine[]
  alone: boolean
  say: (text: string) => Promise<TalkResult>
}

let current: DuelTalk | null = null
const listeners = new Set<() => void>()

export async function sayTo(code: string, text: string): Promise<TalkResult> {
  try {
    const { ok, status } = await api('duel', { code, action: 'say', text })
    if (ok) return 'ok'
    return status === 403 ? 'muted' : status === 429 ? 'too_fast' : 'failed'
  } catch {
    return 'failed'
  }
}

export function shareDuelTalk(next: DuelTalk | null) {
  current = next
  for (const listen of listeners) listen()
}

const subscribe = (listen: () => void) => {
  listeners.add(listen)
  return () => {
    listeners.delete(listen)
  }
}

export const useDuelTalk = () =>
  useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  )
