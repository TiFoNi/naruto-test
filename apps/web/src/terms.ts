'use client'

import { useEffect, useState } from 'react'

export type Dictionary = Record<string, [uk: string, en: string]>

export let terms: Dictionary = {}

let pending: Promise<void> | null = null

function loadTerms() {
  pending ??= import('./i18n/terms.data')
    .then(({ TERMS }) => {
      terms = TERMS
    })
    .catch(() => undefined)
  return pending
}

export function useTerms(enabled: boolean) {
  const [dictionary, setDictionary] = useState<Dictionary>(terms)

  useEffect(() => {
    if (!enabled) return
    let alive = true
    void loadTerms().then(() => alive && setDictionary(terms))
    return () => {
      alive = false
    }
  }, [enabled])

  return dictionary
}
