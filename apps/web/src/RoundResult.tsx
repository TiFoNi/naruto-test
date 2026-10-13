import Link from 'next/link'
import { useEffect, useRef } from 'react'
import Countdown from './Countdown'
import type { Entity, Game } from './games/types'
import { ArrowIcon } from './icons'
import { useI18n, type UiKey } from './i18n'
import { MODES } from './modes'
import { useHref } from './router'
import { dailyNumber, type Stats } from './stats'
import { fullUrl } from './pics'
import Share from './Share'
import { SITE } from './brand'
import type { ModeId } from './modes'

type Props = {
  game: Game
  mode: ModeId
  answer: Entity
  guesses: number
  won: boolean
  skipped: boolean
  stats?: Stats
  onNext: () => void
  challenge?: string
  nextAt?: number
  compact?: boolean
  gained?: number
  day?: string
  board?: string[][]
}

export default function RoundResult({ game, mode, answer, guesses, won, skipped, onNext, challenge, nextAt, compact, gained = 0, day, board }: Props) {
  const { t, name, l } = useI18n()
  const href = useHref()
  const ref = useRef<HTMLDivElement>(null)
  const daily = nextAt !== undefined && !challenge

  useEffect(() => {
    if (daily) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.repeat && ref.current?.offsetParent) onNext()
    }
    const timer = setTimeout(() => window.addEventListener('keydown', onKey), 300)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onNext, daily])

  const note = challenge ? t('challenge.summary', { guesses }) : ''
  const verdict: UiKey = won ? 'result.won' : skipped ? 'result.skipped' : 'result.lost'
  const headline = won && guesses > 0 ? t('result.wonTries', { count: guesses }) : skipped ? t('result.gaveUp') : t(verdict).replace(/…$/, '')
  const number = day ? dailyNumber(day) : 0
  const eyebrow = [daily && number > 0 ? t('result.dailyNo', { count: number }) : null, headline].filter(Boolean).join(' · ')

  const shareKey = daily ? (won ? 'share.dailyWon' : 'share.dailyLost') : won ? 'share.resultWon' : 'share.resultLost'
  const shareText = t(shareKey, {
    name: name(answer),
    tries: t('share.tries', { count: guesses }),
    game: l(game.label),
    mode: t(MODES.find((one) => one.id === mode)?.label ?? 'mode.classic'),
  })
  const shareUrl = `${SITE}${href.play(game.id, mode, daily)}`

  const rows = board?.length === 1 ? [[...board[0], ...Array(Math.max(0, 4 - board[0].length)).fill('blank')]] : board

  const actions = daily ? (
    <div className="result-actions">
      <Link className="ghost" href={href.home}>
        {t('play.back')}
      </Link>
      <Link className="primary" href={href.play(game.id, mode)}>
        {t('daily.playEndless')}
      </Link>
    </div>
  ) : challenge ? (
    <div className="result-actions">
      <Link className="ghost" href={href.home}>
        {t('play.back')}
      </Link>
    </div>
  ) : (
    <div className="result-actions">
      <Link className="ghost" href={href.home}>
        {t('play.back')}
      </Link>
      <button className="primary" onClick={onNext}>
        {t('result.next')}
        <ArrowIcon />
      </button>
    </div>
  )

  return (
    <div ref={ref} className={`card result ${won ? 'won' : skipped ? 'skipped' : 'lost'} ${compact ? 'is-compact' : ''}`}>
      {!compact && (
        <span className="result-hero">
          <img className="result-face" src={fullUrl(game.id, answer.id, answer.image)} alt={name(answer)} />
          <em className="result-badge">{won ? t('result.badgeWon') : skipped ? t('result.gaveUp') : t('result.badgeLost')}</em>
        </span>
      )}
      <div className="result-body">
        <span className="result-eyebrow">{eyebrow}</span>
        <div className="result-name">{name(answer)}</div>
        <div className="result-chips">
          {guesses > 0 && (
            <span className="result-chip">
              <b>{guesses}</b> {t('result.tries', { count: guesses }).replace(/^\d+\s*/, '')}
            </span>
          )}
          {gained > 0 && <span className="result-chip is-xp">{t('result.xp', { count: gained })}</span>}
        </div>
        {note && <p className="round">{note}</p>}
        {daily && (
          <p className="daily-next">
            {t('daily.nextIn')} <Countdown until={nextAt} onDone={onNext} />
          </p>
        )}
        {!compact && actions}
      </div>

      {!skipped && (
        <aside className="result-share">
          <header>
            <span>{t('share.action')}</span>
          </header>
          {!!rows?.length && (
            <div className="result-board" aria-hidden>
              {rows.map((row, index) => (
                <div key={index} className="result-board-row">
                  {row.map((verdict, cell) => (
                    <i key={cell} className={verdict} />
                  ))}
                </div>
              ))}
            </div>
          )}
          <Share text={shareText} url={shareUrl} />
        </aside>
      )}

      {compact && actions}
    </div>
  )
}
