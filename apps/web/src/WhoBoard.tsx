'use client'

import { useEffect, useRef, useState } from 'react'
import CoinFlip from './CoinFlip'
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
  onPick: (entityId: number) => void
  onPass: () => void
  onStrike: (entityId: number) => void
  onAnswer: (entityId: number) => void
  onNext: () => void
}

export default function WhoBoard({ game, byId, duel, busy, onPick, onPass, onStrike, onAnswer, onNext }: Props) {
  const { t, l, tv, lang, name } = useI18n()
  const [info, setInfo] = useState<number | null>(null)
  const [ask, setAsk] = useState<number | null>(null)
  const [choose, setChoose] = useState<number | null>(null)
  const [passing, setPassing] = useState(false)
  const [local, setLocal] = useState<number[] | null>(null)
  const [coin, setCoin] = useState(false)
  const [endOpen, setEndOpen] = useState(true)
  const grid = useRef<HTMLOListElement>(null)

  const server = duel.struck ?? []
  const serverKey = server.join(',')
  const struck = new Set(local ?? server)
  const cards = duel.cards ?? []
  const standing = cards.filter((id) => !struck.has(id))
  const choosing = Boolean(duel.picking)
  const myTurn = Boolean(duel.yourTurn)
  const youPicked = duel.secret !== undefined && duel.secret !== null
  const mine = duel.secret !== undefined && duel.secret !== null ? byId.get(duel.secret) : undefined
  const shown = info !== null ? byId.get(info) : undefined
  const over = duel.status !== 'playing'
  const ended = over && !duel.matchDone
  const answer = ask !== null ? byId.get(ask) : undefined
  const picked = choose !== null ? byId.get(choose) : undefined

  const rivalSecret = duel.rivalSecret !== undefined ? byId.get(duel.rivalSecret) : undefined
  const yourAnswer = duel.yourAnswer !== undefined ? byId.get(duel.yourAnswer) : undefined
  const rivalAnswer = duel.rivalAnswer !== undefined ? byId.get(duel.rivalAnswer) : undefined
  const outcome = over ? (duel.youWon ? 'won' : duel.winner ? 'lost' : 'skipped') : ''

  useEffect(() => {
    setPassing(false)
  }, [myTurn, duel.round])

  useEffect(() => {
    setLocal(null)
  }, [serverKey, duel.round])

  useEffect(() => {
    if (choosing || over || !duel.first || !duel.rival) return
    const key = `nanda.coin.${duel.code}.${duel.round}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      /* приватний режим — покажемо монетку й без позначки */
    }
    setCoin(true)
  }, [choosing, over, duel.code, duel.round, duel.first, duel.rival])

  useEffect(() => {
    if (over) {
      setAsk(null)
      setInfo(null)
      setChoose(null)
    }
    setEndOpen(true)
  }, [over, duel.round])

  const board = duel.size ?? 5
  const modal = info !== null || ask !== null || choose !== null || (ended && endOpen)

  useEffect(() => {
    if (!modal) return
    const root = document.documentElement
    const held = { overflow: root.style.overflow, pad: document.body.style.paddingRight }
    const bar = window.innerWidth - root.clientWidth
    root.style.overflow = 'hidden'
    if (bar > 0) document.body.style.paddingRight = `${bar}px`
    return () => {
      root.style.overflow = held.overflow
      document.body.style.paddingRight = held.pad
    }
  }, [modal])

  useEffect(() => {
    const el = grid.current
    if (!el) return
    const fit = () => {
      const wide = window.innerWidth >= 760
      const columns = wide ? board : Math.min(board, window.innerWidth < 360 ? 4 : 5)
      el.style.setProperty('--cols', String(columns))
      if (!wide) return el.style.removeProperty('--cell')
      const rows = Math.ceil((board * board) / columns)
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
  }, [board, duel.round, over])

  const traits = (entity: Entity) =>
    game.columns.map((column) => ({
      title: l(column.title),
      value: column.text(entity, { tv, lang }),
    }))

  const tap = (id: number) => {
    if (choosing) return youPicked ? undefined : setChoose(id)
    if (struck.has(id) || standing.length > 2) {
      setLocal(struck.has(id) ? [...struck].filter((one) => one !== id) : [...struck, id])
      return onStrike(id)
    }
    if (!myTurn) return
    setAsk(standing.find((other) => other !== id) ?? id)
  }

  const reason = () => {
    if (duel.you?.solved && rivalSecret) return t('who.youSolved', { name: name(rivalSecret) })
    if (duel.rival?.solved) return t('who.rivalSolved')
    if (duel.youWon && rivalAnswer) return t('who.rivalMissed', { name: name(rivalAnswer) })
    if (yourAnswer) return t('who.youMissed', { name: name(yourAnswer) })
    if (duel.youWon) return t('who.rivalTime')
    if (duel.winner) return t('who.youTime')
    return t('who.noAnswer')
  }

  const players = duel.youFirst
    ? [duel.you?.nickname ?? '', duel.rival?.nickname ?? '']
    : [duel.first ?? '', duel.you?.nickname ?? '']

  return (
    <section className="who">
      {coin && (
        <CoinFlip first={players[0]} second={players[1]} youFirst={Boolean(duel.youFirst)} onDone={() => setCoin(false)} />
      )}
      <div className="who-top card">
        {mine && (
          <button type="button" className="who-mine-card" onClick={() => setInfo(mine.id)}>
            <img className="who-mine-thumb" src={fullUrl(game.id, mine.id, mine.image)} alt="" loading="lazy" draggable={false} />
            <span className="who-mine-text">
              <small>{t('who.yours')}</small>
              <b>{name(mine)}</b>
            </span>
          </button>
        )}
        <div className="who-copy">
          <p className="who-first">
            {choosing
              ? youPicked
                ? t('who.pickWait')
                : t('who.pickTitle')
              : myTurn
                ? t('who.yourTurn')
                : duel.turn
                  ? t('who.rivalTurn', { name: duel.turn })
                  : ''}
          </p>
          <p className="muted">
            {choosing
              ? youPicked
                ? t('who.pickWaitHint')
                : duel.rivalPicked
                  ? t('who.rivalPicked')
                  : t('who.pickHint')
              : myTurn
                ? t('who.turnHint')
                : t('who.waitTurn')}
          </p>
        </div>

        {!choosing && !over && myTurn && (
          <button
            type="button"
            className="primary who-pass"
            disabled={passing}
            onClick={() => {
              setPassing(true)
              onPass()
            }}
          >
            {t('who.pass')}
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
          <section
            className={`card modal who-result ${outcome}`}
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" aria-label={t('profile.close')} onClick={() => setEndOpen(false)}>
              <CloseIcon />
            </button>
            <span className="who-result-mark" aria-hidden>
              {duel.youWon ? <TrophyIcon /> : <SwordsIcon />}
            </span>
            <h2>{duel.youWon ? t('duel.youWon') : duel.winner ? t('duel.youLost', { name: duel.winner }) : t('duel.draw')}</h2>
            <p className="who-reason">{reason()}</p>
            <div className="who-reveal">
              {mine && (
                <figure>
                  <img src={fullUrl(game.id, mine.id, mine.image)} alt="" draggable={false} />
                  <figcaption>
                    <small>{t('who.yourHero')}</small>
                    <b>{name(mine)}</b>
                  </figcaption>
                </figure>
              )}
              {rivalSecret && (
                <figure>
                  <img src={fullUrl(game.id, rivalSecret.id, rivalSecret.image)} alt="" draggable={false} />
                  <figcaption>
                    <small>{t('who.rivalHero')}</small>
                    <b>{name(rivalSecret)}</b>
                  </figcaption>
                </figure>
              )}
            </div>
            <p className="who-result-score">
              <b>{duel.you?.wins ?? 0}</b>
              <span>:</span>
              <b>{duel.rival?.wins ?? 0}</b>
            </p>
            <p className="muted small">{t('duel.roundOf', { round: duel.round, best: duel.best })}</p>
            <div className="result-actions">
              <button className="primary" onClick={onNext} disabled={busy || duel.you?.wantsNext}>
                {duel.you?.wantsNext ? t('duel.nextWait') : t('duel.next')}
              </button>
            </div>
            {duel.rival?.wantsNext && !duel.you?.wantsNext && (
              <p className="muted small">{t('duel.rivalWantsNext', { name: duel.rival.nickname })}</p>
            )}
          </section>
        </div>
      )}

      <ol className={`who-grid ${choosing ? (youPicked ? 'who-waiting' : 'who-choosing') : ''}`} ref={grid} style={{ ['--board' as string]: board }}>
        {cards.map((id) => {
          const entity = byId.get(id)
          if (!entity) return null
          const off = struck.has(id)
          return (
            <li
              key={id}
              className={off ? 'off' : ''}
              onContextMenu={(event) => {
                event.preventDefault()
                setInfo(id)
              }}
            >
              <button
                type="button"
                className="who-card"
                aria-label={choosing ? `${name(entity)} — ${t('who.pickDo')}` : `${name(entity)} — ${off ? t('who.open') : t('who.close')}`}
                disabled={over || (choosing && (busy || youPicked))}
                onClick={() => tap(id)}
              >
                <span className="who-flip">
                  <span className="who-face who-front">
                    <img className="who-thumb" src={fullUrl(game.id, entity.id, entity.image)} alt="" loading="lazy" draggable={false} />
                    <span className="who-name">
                      <span>{name(entity)}</span>
                    </span>
                  </span>
                  <span className="who-face who-back" aria-hidden>
                    ?
                  </span>
                </span>
              </button>
              <button type="button" className="who-info" aria-label={t('who.info')} tabIndex={off ? -1 : 0} onClick={() => setInfo(id)}>
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
            {choosing && !youPicked && (
              <div className="who-ask">
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setInfo(null)
                    setChoose(shown.id)
                  }}
                >
                  {t('who.pickDo')}
                </button>
              </div>
            )}
            {!choosing && !over && myTurn && !struck.has(shown.id) && standing.length > 1 && (
              <div className="who-ask">
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    setInfo(null)
                    setAsk(shown.id)
                  }}
                >
                  {t('who.markAnswer')}
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {choose !== null && picked && (
        <div className="modal-backdrop" onClick={() => setChoose(null)} role="presentation">
          <section className="card modal who-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label={t('profile.close')} onClick={() => setChoose(null)}>
              <CloseIcon />
            </button>
            <header className="who-modal-head">
              <img className="who-modal-pic" src={fullUrl(game.id, picked.id, picked.image)} alt="" draggable={false} />
              <b>{name(picked)}</b>
            </header>
            <div className="who-warn who-pick-warn">
              <b>{t('who.pickAsk')}</b>
              <span>{t('who.pickWarn')}</span>
            </div>
            <div className="who-ask">
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => {
                  onPick(choose)
                  setChoose(null)
                }}
              >
                {t('who.pickDo')}
              </button>
              <button type="button" className="ghost" onClick={() => setChoose(null)}>
                {t('profile.cancel')}
              </button>
            </div>
          </section>
        </div>
      )}

      {ask !== null && answer && (
        <div className="modal-backdrop" onClick={() => setAsk(null)} role="presentation">
          <section className="card modal who-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label={t('profile.close')} onClick={() => setAsk(null)}>
              <CloseIcon />
            </button>
            <header className="who-modal-head">
              <img className="who-modal-pic" src={fullUrl(game.id, answer.id, answer.image)} alt="" draggable={false} />
              <b>{name(answer)}</b>
            </header>
            <p className="who-warn">{t('who.answerWarn')}</p>
            <div className="who-ask">
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => {
                  onAnswer(ask)
                  setAsk(null)
                }}
              >
                {t('who.answer')}
              </button>
              <button type="button" className="ghost" onClick={() => setAsk(null)}>
                {t('profile.cancel')}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
