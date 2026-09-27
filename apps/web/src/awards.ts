'use client'

import { api } from './api'
import { keepPerUser } from './session-cache'

export type AwardRow = { id: string; tier: string; done: boolean; claimed: boolean }
export type FreshAward = { id: string; tier: string }

const watchers = new Set<(list: FreshAward[]) => void>()

let cache: FreshAward[] | null = null
let pending: Promise<FreshAward[]> | null = null

keepPerUser(() => {
  cache = null
  pending = null
  for (const watcher of watchers) watcher([])
})

export function putAwards(list: AwardRow[]) {
  cache = list.filter((a) => a.done && !a.claimed).map(({ id, tier }) => ({ id, tier }))
  for (const watcher of watchers) watcher(cache)
  return cache
}

export function watchAwards(watcher: (list: FreshAward[]) => void) {
  watchers.add(watcher)
  return () => watchers.delete(watcher)
}

export function freshAwards() {
  if (cache) return Promise.resolve(cache)
  pending ??= api<{ awards?: FreshAward[] }>('awards')
    .then(({ ok, data }) => {
      cache = ok ? (data.awards ?? []) : []
      for (const watcher of watchers) watcher(cache)
      return cache
    })
    .finally(() => {
      pending = null
    })
  return pending
}
