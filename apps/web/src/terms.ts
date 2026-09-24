'use client'

import { useEffect, useState } from 'react'
import { api } from './api'

export type Dictionary = Record<string, [uk: string, en: string]>

export let terms: Dictionary = {}

let pending: Promise<void> | null = null

function fetchTerms() {
  pending ??= api<{ terms?: Dictionary }>('terms')
    .then(({ ok, data }) => {
      if (ok && data.terms) terms = data.terms
    })
    .catch(() => undefined)
  return pending
}

export function useTerms(enabled: boolean) {
  const [dictionary, setDictionary] = useState<Dictionary>(terms)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    void fetchTerms().then(() => alive && setDictionary(terms))
    return () => {
      alive = false
    }
  }, [enabled])

  return dictionary
}
