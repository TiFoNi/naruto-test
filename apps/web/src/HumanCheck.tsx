'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api'
import { HUMAN_CHECK_EVENT } from './human'
import { useI18n } from './i18n'
import { CloseIcon } from './icons'

type Turnstile = {
  render: (box: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'error-callback': () => void }) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ''
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let loading: Promise<void> | null = null

const loadTurnstile = () =>
  (loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error('turnstile'))
    }
    document.head.appendChild(script)
  }))

export default function HumanCheck() {
  const { t, error } = useI18n()
  const [open, setOpen] = useState(false)
  const [problem, setProblem] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ask = () => {
      setProblem('')
      setOpen(true)
    }
    window.addEventListener(HUMAN_CHECK_EVENT, ask)
    return () => window.removeEventListener(HUMAN_CHECK_EVENT, ask)
  }, [])

  useEffect(() => {
    if (!open) return
    let widget: string | undefined
    let gone = false
    const failed = () => setProblem(error('human_failed'))
    if (!SITE_KEY) return failed()
    loadTurnstile()
      .then(() => {
        if (gone || !box.current || !window.turnstile) return
        widget = window.turnstile.render(box.current, {
          sitekey: SITE_KEY,
          'error-callback': failed,
          callback: async (token) => {
            const { ok } = await api('human', { token })
            if (ok) setOpen(false)
            else failed()
          },
        })
      })
      .catch(failed)
    return () => {
      gone = true
      if (widget) window.turnstile?.remove(widget)
    }
  }, [open, error])

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" role="presentation">
      <section className="card modal give-up-ask human-check" role="dialog" aria-modal="true" aria-label={t('human.title')}>
        <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label={t('human.close')}>
          <CloseIcon />
        </button>
        <h2>{t('human.title')}</h2>
        <p className="muted">{t('human.hint')}</p>
        <div className="human-check-box" ref={box} />
        {problem && <p className="human-check-error">{problem}</p>}
      </section>
    </div>,
    document.body,
  )
}
