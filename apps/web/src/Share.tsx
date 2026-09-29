'use client'

import { useEffect, useRef, useState } from 'react'
import { CopyIcon } from './icons'
import { RedditIcon, ShareIcon, TelegramIcon, WhatsAppIcon, XIcon } from './icons/social'
import { useI18n } from './i18n'

type Props = { text: string; url: string; label?: string; compact?: boolean }

const NETWORKS = [
  {
    id: 'telegram',
    Icon: TelegramIcon,
    href: (text: string, url: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'x',
    Icon: XIcon,
    href: (text: string, url: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    id: 'whatsapp',
    Icon: WhatsAppIcon,
    href: (text: string, url: string) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
  },
  {
    id: 'reddit',
    Icon: RedditIcon,
    href: (text: string, url: string) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
]

export default function Share({ text, url, label, compact }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(true)
  const [copied, setCopied] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    const key = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away)
    window.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', away)
      window.removeEventListener('keydown', key)
    }
  }, [open])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setCopied(true)
    } catch {
      setOpen(true)
    }
  }

  const start = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text, url })
        return
      } catch {
        /* користувач закрив системне вікно */
      }
    }
    const spot = box.current?.getBoundingClientRect()
    if (spot) setUp(spot.top > 260)
    setOpen((was) => !was)
  }

  return (
    <div className="share" ref={box}>
      <button type="button" className={`share-open ${compact ? 'small' : ''}`} onClick={start}>
        <ShareIcon />
        {!compact && (label ?? t('share.action'))}
      </button>

      {open && (
        <div className={`share-menu ${up ? 'up' : 'down'}`} role="menu">
          {NETWORKS.map(({ id, Icon, href }) => (
            <a key={id} className="share-net" href={href(text, url)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
              <Icon />
              {t(`share.${id}` as 'share.telegram')}
            </a>
          ))}
          <button type="button" className="share-net" onClick={copy}>
            <CopyIcon />
            {t(copied ? 'duel.copied' : 'duel.copy')}
          </button>
        </div>
      )}

      {copied && !open && <span className="share-done">{t('duel.copied')}</span>}
    </div>
  )
}
