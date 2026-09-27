'use client'

import { api } from './api'
import { keepPerUser } from './session-cache'

export type AwardRow = { id: string; tier: string; done: boolean; claimed: boolean }
export type FreshAward = { id: string; tier: string }
export type DuelInvite = { code: string; from: string; game: string | null; mode: string | null; best: number; seconds: number; at: string }
export type Feed = { awards: FreshAward[]; invites: DuelInvite[] }

const EMPTY: Feed = { awards: [], invites: [] }

const watchers = new Set<(feed: Feed) => void>()

let cache: Feed | null = null
let pending: Promise<Feed> | null = null

keepPerUser(() => {
  cache = null
  pending = null
  for (const watcher of watchers) watcher(EMPTY)
})

function publish(feed: Feed) {
  cache = feed
  for (const watcher of watchers) watcher(feed)
  return feed
}

export function putAwards(list: AwardRow[]) {
  return publish({
    awards: list.filter((a) => a.done && !a.claimed).map(({ id, tier }) => ({ id, tier })),
    invites: cache?.invites ?? [],
  })
}

export function dropInvite(code: string) {
  return publish({ awards: cache?.awards ?? [], invites: (cache?.invites ?? []).filter((invite) => invite.code !== code) })
}

export function watchFeed(watcher: (feed: Feed) => void) {
  watchers.add(watcher)
  return () => watchers.delete(watcher)
}

export function refreshFeed() {
  cache = null
  pending = null
  return freshFeed()
}

export function freshFeed() {
  if (cache) return Promise.resolve(cache)
  pending ??= api<Partial<Feed>>('awards')
    .then(({ ok, data }) => (ok ? publish({ awards: data.awards ?? [], invites: data.invites ?? [] }) : EMPTY))
    .catch(() => EMPTY)
    .finally(() => {
      pending = null
    })
  return pending
}
