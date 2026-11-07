'use client'

import { useEffect, useState } from 'react'
import GemIcon from './GemIcon'
import Share from './Share'
import { api } from './api'
import { useI18n } from './i18n'
import { CopyIcon } from './icons'

type Board = { code: string; invited: number; paid: number; reward: number; level: number }

const COPIED_MS = 1500

export default function InviteCard() {
  const { t } = useI18n()
  const [board, setBoard] = useState<Board | null>(null)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    void api<Board>('invite').then(({ ok, data }) => {
      if (!alive || !ok || !data.code) return
      setBoard(data)
      setLink(`${window.location.origin}/?ref=${data.code}`)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  if (!board) return null

  const copy = () => {
    navigator.clipboard?.writeText(link).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  return (
    <section className="card mates-ticket">
      <div className="mates-ticket-main">
        <h2>{t('invite.title')}</h2>
        <p className="muted">{t('invite.lead', { level: board.level })}</p>
        <div className="mates-ticket-row">
          <code className="mates-ticket-code" title={link}>
            {board.code}
          </code>
          <button type="button" className="ghost" onClick={copy}>
            <CopyIcon />
            {copied ? t('duel.copied') : t('duel.copyLink')}
          </button>
          <Share text={t('invite.shareText')} url={link} />
        </div>
      </div>
      <div className="mates-ticket-stub">
        <GemIcon count={3} sparkles={false} />
        <b>+{board.reward}</b>
        <small>{t('invite.prize')}</small>
        <span>{t('invite.tally', { came: board.invited, reached: board.paid })}</span>
      </div>
    </section>
  )
}
