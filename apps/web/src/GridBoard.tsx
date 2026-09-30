'use client'

import { Fragment, useEffect, useState } from 'react'
import CharacterSearch from './CharacterSearch'
import Thumb from './Thumb'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import { CloseIcon, SwordsIcon, TrophyIcon } from './icons'
import type { DuelView } from './useDuel'

type Props = {
  game: Game
  byId: Map<number, Entity>
  duel: DuelView
  busy: boolean
  error: string | null
  onMark: (cell: number, entityId: number) => void
  onNext: () => void
}

export default function GridBoard({ game, byId, duel, busy, error, onMark, onNext }: Props) {
  const { t, l, tv, name, error: errorText } = useI18n()
  const [cell, setCell] = useState<number | null>(null)
  const [endOpen, setEndOpen] = useState(true)

  const grid = duel.grid
  const over = duel.status !== 'playing'
  const ended = over && !duel.matchDone
  const myTurn = Boolean(duel.yourTurn)

  useEffect(() => {
    if (cell !== null && duel.grid?.marks[cell]) setCell(null)
  }, [cell, duel.grid?.marks])

  if (!grid) return <div className="card center muted">{t('loading')}</div>

  const label = (facet: { key: string; value: string }) => {
    const column = game.columns.find((one) => one.key === facet.key)
    return { head: column ? l(column.title) : facet.key, value: tv(facet.value) }
  }

  const used = new Set<number>((grid.picks ?? []).filter((one) => typeof one === 'number') as number[])
  const outcome = over ? (duel.youWon ? 'won' : duel.winner ? 'lost' : 'skipped') : ''

  const place = (entity: Entity) => {
    if (cell === null) return
    onMark(cell, entity.id)
  }

  return (
    <section className="grid-mode">
      <div className={`who-top card ${myTurn && !over ? 'on-turn' : ''}`}>
        <div className="who-copy">
          <p className="who-first">{over ? t('grid.done') : myTurn ? t('who.yourTurn') : duel.turn ? t('who.rivalTurn', { name: duel.turn }) : ''}</p>
          <p className="muted">{over ? t('grid.doneHint') : myTurn ? t('grid.hint') : t('grid.waitHint')}</p>
        </div>
      </div>

      <div className="grid-board card">
        <div className="grid-table">
          <span className="grid-corner" aria-hidden />
          {grid.cols.map((facet, at) => {
            const { head, value } = label(facet)
            return (
              <div key={`col-${at}`} className="grid-axis">
                <small>{head}</small>
                <b>{value}</b>
              </div>
            )
          })}

          {grid.rows.map((row, y) => {
            const { head, value } = label(row)
            return (
              <Fragment key={`row-${y}`}>
                <div className="grid-axis">
                  <small>{head}</small>
                  <b>{value}</b>
                </div>
                {grid.cols.map((_, x) => {
                  const at = y * 3 + x
                  const mark = grid.marks[at]
                  const picked = grid.picks?.[at]
                  const hero = typeof picked === 'number' ? byId.get(picked) : undefined
                  return (
                    <button
                      key={at}
                      type="button"
                      className={`grid-cell ${mark ?? 'free'}`}
                      disabled={Boolean(mark) || over || busy || !myTurn}
                      onClick={() => setCell(at)}
                    >
                      {hero ? (
                        <>
                          <Thumb game={game} entity={hero} className="grid-face" />
                          <span className="grid-name">{name(hero)}</span>
                        </>
                      ) : (
                        <span className="grid-plus" aria-hidden>
                          +
                        </span>
                      )}
                    </button>
                  )
                })}
              </Fragment>
            )
          })}
        </div>
      </div>

      {cell !== null && (
        <div className="modal-backdrop" onClick={() => setCell(null)} role="presentation">
          <section className="card modal grid-ask" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label={t('profile.close')} onClick={() => setCell(null)}>
              <CloseIcon />
            </button>
            <h2>{t('grid.askTitle')}</h2>
            <p className="muted grid-ask-facets">
              <span>{label(grid.rows[Math.floor(cell / 3)]).value}</span>
              <i>+</i>
              <span>{label(grid.cols[cell % 3]).value}</span>
            </p>
            <CharacterSearch game={game} exclude={used} busy={busy} onPick={place} />
            {error && <p className="notice error grid-ask-error">{errorText(error)}</p>}
          </section>
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
          </section>
        </div>
      )}
    </section>
  )
}
