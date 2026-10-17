'use client'

import { useEffect, useRef, useState } from 'react'
import { CLUE_WORD_MAX } from '@nanda/game'
import { fullUrl } from './pics'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import { CloseIcon, InfoIcon, SwordsIcon, TrophyIcon } from './icons'
import type { DuelView } from './useDuel'

type Props = {
  game: Game
  byId: Map<number, Entity>
  duel: DuelView
  busy: boolean
  onClue: (word: string, count: number) => void
  onOpen: (index: number) => void
  onSkip: () => void
  onNext: () => void
}

const KINDS = ['own', 'foe', 'grey', 'black'] as const

export default function ClueBoard({ game, byId, duel, busy, onClue, onOpen, onSkip, onNext }: Props) {
  const { t, l, tv, lang, name } = useI18n()
  const [info, setInfo] = useState<number | null>(null)
  const [word, setWord] = useState('')
  const [count, setCount] = useState(1)
  const [endOpen, setEndOpen] = useState(true)
  const [focus, setFocus] = useState<'all' | 'own' | 'foe' | 'grey'>('all')
  const grid = useRef<HTMLOListElement>(null)

  const clue = duel.clue
  const over = duel.status !== 'playing'
  const ended = over && !duel.matchDone
  const side = duel.size ?? 5
  const shown = info !== null ? byId.get(info) : undefined
  const lead = Boolean(clue?.lead)
  const mine = Boolean(clue?.yours) && !over
  const asking = lead && mine && !clue?.word
  const picking = !lead && mine && Boolean(clue?.word)
  const outcome = over ? (duel.youWon ? 'won' : duel.winner ? 'lost' : 'skipped') : ''

  useEffect(() => {
    setWord('')
    setCount(1)
  }, [clue?.turn, duel.round])

  useEffect(() => {
    setFocus('all')
  }, [duel.round])

  useEffect(() => {
    if (over) setInfo(null)
    setEndOpen(true)
  }, [over, duel.round])

  useEffect(() => {
    const el = grid.current
    if (!el) return
    const fit = () => {
      const wide = window.innerWidth >= 760
      const columns = wide ? side : Math.min(side, window.innerWidth < 360 ? 4 : 5)
      el.style.setProperty('--cols', String(columns))
      if (!wide) return el.style.removeProperty('--cell')
      const rows = Math.ceil((side * side) / columns)
      const top = el.getBoundingClientRect().top + window.scrollY
      const room = window.innerHeight - top - 24
      el.style.setProperty('--cell', `${Math.max(76, Math.min(152, Math.floor(room / rows) - 10))}px`)
    }
    fit()
    const watch = new ResizeObserver(fit)
    watch.observe(document.body)
    window.addEventListener('resize', fit)
    return () => {
      watch.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [side, duel.round, over])

  const traits = (entity: Entity) =>
    game.columns.map((column) => ({ title: l(column.title), value: column.text(entity, { tv, lang }) }))

  if (!clue) return null

  const give = () => {
    const text = word.trim()
    if (!text || busy) return
    onClue(text, count)
  }

  const turnLine = over
    ? duel.youWon
      ? t('clue.youWon')
      : duel.winner
        ? t('clue.youLost')
        : t('duel.draw')
    : mine
      ? lead
        ? clue.word
          ? t('clue.mateGuessing')
          : t('clue.yourClue')
        : clue.word
          ? t('clue.yourPick')
          : t('clue.waitClue')
      : t('clue.foeTurn')

  const hintLine = over
    ? ''
    : clue.word
      ? t('clue.now', { word: clue.word, count: clue.count, left: Math.max(0, clue.left) })
      : mine && lead
        ? t('clue.clueHint')
        : t('clue.noClue')

  return (
    <section className="clue">
      <div className={`clue-top card ${mine && !over ? 'on-turn' : ''}`}>
        <div className="clue-score">
          <span className="clue-tally is-own">
            <b>{clue.mine}</b>
            <small>{t('clue.yoursLeft')}</small>
          </span>
          <span className="clue-tally is-foe">
            <b>{clue.foes}</b>
            <small>{t('clue.foesLeft')}</small>
          </span>
        </div>

        <div className="clue-copy">
          <p className="clue-turn">{turnLine}</p>
          {hintLine && <p className="muted">{hintLine}</p>}
        </div>

        {asking && (
          <div className="clue-form">
            <input
              value={word}
              maxLength={CLUE_WORD_MAX}
              placeholder={t('clue.wordPlaceholder')}
              onChange={(event) => setWord(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && give()}
            />
            <div className="clue-count">
              <button type="button" aria-label={t('clue.less')} disabled={count <= 1} onClick={() => setCount((n) => Math.max(1, n - 1))}>
                −
              </button>
              <b>{count}</b>
              <button type="button" aria-label={t('clue.more')} disabled={count >= 9} onClick={() => setCount((n) => Math.min(9, n + 1))}>
                +
              </button>
            </div>
            <button type="button" className="primary" disabled={busy || !word.trim()} onClick={give}>
              {t('clue.give')}
            </button>
          </div>
        )}

        {lead && !over && (
          <div className="clue-filter" role="group" aria-label={t('clue.focusTitle')}>
            {(['all', 'own', 'foe', 'grey'] as const).map((one) => (
              <button
                key={one}
                type="button"
                className={`clue-chip is-${one} ${focus === one ? 'on' : ''}`}
                aria-pressed={focus === one}
                onClick={() => setFocus(one)}
              >
                {t(one === 'all' ? 'clue.focusAll' : one === 'own' ? 'clue.focusOwn' : one === 'foe' ? 'clue.focusFoe' : 'clue.focusGrey')}
              </button>
            ))}
          </div>
        )}

        {picking && (
          <button type="button" className="ghost clue-pass" disabled={busy} onClick={onSkip}>
            {t('clue.pass')}
          </button>
        )}
      </div>

      {ended && !endOpen && (
        <div className={`card who-endbar ${outcome}`}>
          <b>{duel.youWon ? t('duel.youWon') : duel.winner ? t('duel.youLost', { name: duel.winner }) : t('duel.draw')}</b>
          <div className="who-endbar-actions">
            <button type="button" className="ghost" onClick={() => setEndOpen(true)}>
              {t('who.showResult')}
            </button>
            <button type="button" className="primary" onClick={onNext} disabled={busy || duel.you?.wantsNext}>
              {duel.you?.wantsNext ? t('duel.nextWait') : t('duel.next')}
            </button>
          </div>
        </div>
      )}

      {ended && endOpen && (
        <div className="modal-backdrop" onClick={() => setEndOpen(false)} role="presentation">
          <section className={`card modal who-result ${outcome}`} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label={t('profile.close')} onClick={() => setEndOpen(false)}>
              <CloseIcon />
            </button>
            <span className="who-result-mark" aria-hidden>
              {duel.youWon ? <TrophyIcon /> : <SwordsIcon />}
            </span>
            <h2>{duel.youWon ? t('duel.youWon') : duel.winner ? t('duel.youLost', { name: duel.winner }) : t('duel.draw')}</h2>
            <p className="who-reason">{clue.hit?.kind === 3 ? t('clue.blackEnd') : t('clue.allFound')}</p>
            <p className="muted small">{t('duel.roundOf', { round: duel.round, best: duel.best })}</p>
            <div className="result-actions">
              <button className="primary" onClick={onNext} disabled={busy || duel.you?.wantsNext}>
                {duel.you?.wantsNext ? t('duel.nextWait') : t('duel.next')}
              </button>
            </div>
          </section>
        </div>
      )}

      <ol
        className={`who-grid clue-grid ${lead ? 'is-lead' : ''} ${lead && focus !== 'all' ? `has-focus focus-${focus}` : ''}`}
        ref={grid}
        style={{ ['--board' as string]: side }}
      >
        {clue.cards.map((id, index) => {
          const entity = byId.get(id)
          if (!entity) return null
          const open = clue.shown[index]
          const secret = clue.key?.[index]
          const kind = open !== null && open !== undefined ? KINDS[open] : undefined
          const hidden = secret !== undefined && open === null ? KINDS[secret] : undefined
          return (
            <li key={`${id}-${index}`} className={`${kind ? `off kind-${kind}` : ''} ${hidden ? `peek-${hidden}` : ''}`}>
              <button
                type="button"
                className="who-card"
                aria-label={name(entity)}
                disabled={!picking || busy || open !== null}
                onClick={() => picking && open === null && onOpen(index)}
              >
                <span className="who-flip">
                  <span className="who-face who-front">
                    <img className="who-thumb" src={fullUrl(game.id, entity.id, entity.image)} alt="" loading="lazy" draggable={false} />
                    <span className="who-name">
                      <span>{name(entity)}</span>
                    </span>
                  </span>
                  <span className="who-face who-back clue-back" aria-hidden>
                    <span className="clue-back-name">{name(entity)}</span>
                  </span>
                </span>
              </button>
              <button type="button" className="who-info" aria-label={t('who.info')} onClick={() => setInfo(id)}>
                <InfoIcon />
              </button>
            </li>
          )
        })}
      </ol>

      {shown && (
        <div className="modal-backdrop" onClick={() => setInfo(null)} role="presentation">
          <section className="card modal who-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label={t('profile.close')} onClick={() => setInfo(null)}>
              <CloseIcon />
            </button>
            <header className="who-modal-head">
              <img className="who-modal-pic" src={fullUrl(game.id, shown.id, shown.image)} alt="" draggable={false} />
              <b>{name(shown)}</b>
            </header>
            <dl className="who-traits">
              {traits(shown).map((trait) => (
                <div key={trait.title}>
                  <dt>{trait.title}</dt>
                  <dd>{trait.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </section>
  )
}
