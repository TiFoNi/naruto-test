'use client'

import { useEffect, useState } from 'react'
import { comingSale, nextSaleEdge, saleAt, type Sale } from '@nanda/game'

const PREVIEW_KEY = 'nanda.sale-preview'
const LONGEST = 2 ** 31 - 1

const previewSale = () => {
  if (process.env.NODE_ENV === 'production') return null
  try {
    const asked = new URLSearchParams(window.location.search).get('sale')
    if (asked !== null) sessionStorage.setItem(PREVIEW_KEY, asked)
    const id = sessionStorage.getItem(PREVIEW_KEY)
    return id ? comingSale(id, Date.now()) : null
  } catch {
    return null
  }
}

export const offLabel = (sale: Sale) => `−${Math.round(sale.off * 100)}%`

export function useSale(): Sale | null {
  const [now, setNow] = useState(0)
  const [preview, setPreview] = useState<Sale | null>(null)

  useEffect(() => {
    setNow(Date.now())
    setPreview(previewSale())
  }, [])

  useEffect(() => {
    if (!now) return
    const next = nextSaleEdge(now)
    const wake = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', wake)
    const timer = next === undefined ? 0 : window.setTimeout(() => setNow(Date.now()), Math.min(LONGEST, next - now + 50))
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [now])

  return preview ?? saleAt(now)
}
