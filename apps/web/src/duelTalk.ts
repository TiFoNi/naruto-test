'use client'

import { useSyncExternalStore } from 'react'

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
  say: (text: string) => Promise<TalkResult>
}

let current: DuelTalk | null = null
const listeners = new Set<() => void>()

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
