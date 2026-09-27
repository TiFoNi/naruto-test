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


function publish(list: FreshAward[]) {
  cache = list
  for (const watcher of watchers) watcher(list)
  return list
}

export function putAwards(list: AwardRow[]) {
  return publish(list.filter((a) => a.done && !a.claimed).map(({ id, tier }) => ({ id, tier })))
}

export function watchAwards(watcher: (list: FreshAward[]) => void) {
  watchers.add(watcher)
  return () => watchers.delete(watcher)
}

export function refreshAwards() {
  cache = null
  pending = null
  return freshAwards()
}

export function freshAwards() {
  if (cache) return Promise.resolve(cache)
  pending ??= api<{ awards?: FreshAward[] }>('awards')
    .then(({ ok, data }) => (ok ? publish(data.awards ?? []) : []))
    .catch(() => [] as FreshAward[])
    .finally(() => {
      pending = null
    })
  return pending
}
