'use client'

import { api } from './api'
import { keepPerUser } from './session-cache'

export const AWARDS_FILTER = 'nanda-awards-filter'

export type AwardRow = { id: string; tier: string; family?: string | null; kind?: string; done: boolean; claimed: boolean }
export type FreshAward = { id: string; tier: string; family?: string | null; kind?: string }
export type DuelInvite = { code: string; from: string; game: string | null; mode: string | null; best: number; seconds: number; at: string }
export type FriendAsk = { id: string; nickname: string; tag: string | null; at: string }
export type CoinNews = { coins: number; at: string }
export type Feed = { awards: FreshAward[]; invites: DuelInvite[]; requests: FriendAsk[]; frames: string[]; coins: CoinNews | null }

const EMPTY: Feed = { awards: [], invites: [], requests: [], frames: [], coins: null }

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
    ...(cache ?? EMPTY),
    awards: list.filter((a) => a.done && !a.claimed).map(({ id, tier, family, kind }) => ({ id, tier, family, kind })),
  })
}

export function dropInvite(code: string) {
  return publish({ ...(cache ?? EMPTY), invites: (cache?.invites ?? []).filter((invite) => invite.code !== code) })
}

export function dropCoins() {
  return publish({ ...(cache ?? EMPTY), coins: null })
}

export function dropFrames() {
  return publish({ ...(cache ?? EMPTY), frames: [] })
}

export function dropRequest(id: string) {
  return publish({ ...(cache ?? EMPTY), requests: (cache?.requests ?? []).filter((one) => one.id !== id) })
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
    .then(({ ok, data }) =>
      ok
        ? publish({
            awards: data.awards ?? [],
            invites: data.invites ?? [],
            requests: data.requests ?? [],
            frames: data.frames ?? [],
            coins: data.coins ?? null,
          })
        : EMPTY,
    )
    .catch(() => EMPTY)
    .finally(() => {
      pending = null
    })
  return pending
}
