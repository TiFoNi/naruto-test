'use client'

import Link from 'next/link'
import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { useI18n } from './i18n'
import { BackIcon } from './icons'
import { canGoBack, useNavigate } from './router'

type Props = { href: string; children: ReactNode; onClick?: () => void }

export default function BackButton({ href, children, onClick }: Props) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [returning, setReturning] = useState(false)

  useEffect(() => setReturning(!onClick && canGoBack()), [onClick])

  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      event.preventDefault()
      return onClick()
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    if (!returning) return
    event.preventDefault()
    navigate.back()
  }

  return (
    <Link className="back" href={href} onClick={handle}>
      <BackIcon />
      {returning ? t('common.back') : children}
    </Link>
  )
}
