'use client'

import { useState } from 'react'
import { fullUrl } from './pics'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import { CloseIcon } from './icons'
import type { DuelView } from './useDuel'

type Props = {
  game: Game
  byId: Map<number, Entity>
  duel: DuelView
  busy: boolean
  onStrike: (entityId: number) => void
  onNext: () => void
  onFinal: () => void
}

export default function WhoBoard({ game, byId, duel, busy, onStrike, onNext, onFinal }: Props) {
  const { t, l, tv, lang, name } = useI18n()
  const [info, setInfo] = useState<number | null>(null)
  const [ask, setAsk] = useState<number | null>(null)

  const struck = new Set(duel.struck ?? [])
  const cards = duel.cards ?? []
  const standing = cards.filter((id) => !struck.has(id))
  const mine = duel.secret !== undefined ? byId.get(duel.secret) : undefined
  const shown = info !== null ? byId.get(info) : undefined
  const over = duel.status !== 'playing'
  const answer = ask !== null ? byId.get(standing.find((id) => id !== ask) ?? -1) : undefined

  const rivalSecret = duel.rivalSecret !== undefined ? byId.get(duel.rivalSecret) : undefined
  const yourAnswer = duel.yourAnswer !== undefined ? byId.get(duel.yourAnswer) : undefined
  const rivalAnswer = duel.rivalAnswer !== undefined ? byId.get(duel.rivalAnswer) : undefined
  const outcome = over ? (duel.youWon ? 'won' : duel.winner ? 'lost' : 'skipped') : ''

  const traits = (entity: Entity) => game.columns.map((column) => ({ title: l(column.title), value: column.text(entity, { tv, lang }) }))

  const pick = (id: number) => {
    if (struck.has(id) || standing.length > 2) return onStrike(id)
    setAsk(id)
  }

  const reason = () => {
    if (duel.youWon && rivalAnswer) return t('who.rivalMissed', { name: name(rivalAnswer) })
    if (duel.youWon) return t('who.rivalTime')
    if (duel.winner && yourAnswer && !duel.you?.solved) return t('who.youMissed', { name: name(yourAnswer) })
    if (duel.winner) return t('who.youTime')
    return t('who.noAnswer')
  }

  return (
    <section className="who">
      <div className="who-top card">
        {mine && (
          <div className="who-mine-card">
            <img className="who-mine-thumb" src={fullUrl(game.id, mine.id, mine.image)} alt="" loading="lazy" />
            <span className="who-mine-text">
              <small>{t('who.yours')}</small>
              <b>{name(mine)}</b>
            </span>
          </div>
        )}
        <div className="who-copy">
          <p className="who-first">{duel.youFirst ? t('who.youFirst') : duel.first ? t('who.first', { name: duel.first }) : ''}</p>
          <p className="muted">{t('who.hint')}</p>
        </div>
      </div>

      {over && (
        <div className={`card result who-result ${outcome}`}>
          <h2>
            {duel.matchDone
              ? duel.youWon
                ? t('duel.matchWon')
                : t('duel.matchLost', { name: duel.winner ?? '' })
              : duel.youWon
                ? t('duel.youWon')
                : duel.winner
                  ? t('duel.youLost', { name: duel.winner })
                  : t('duel.draw')}
          </h2>
          <p className="who-reason">{reason()}</p>
          <div className="who-reveal">
            {mine && (
              <figure>
                <img src={fullUrl(game.id, mine.id, mine.image)} alt="" />
                <figcaption>
                  <small>{t('who.yourHero')}</small>
                  <b>{name(mine)}</b>
                </figcaption>
              </figure>
            )}
            {rivalSecret && (
              <figure>
                <img src={fullUrl(game.id, rivalSecret.id, rivalSecret.image)} alt="" />
                <figcaption>
                  <small>{t('who.rivalHero')}</small>
                  <b>{name(rivalSecret)}</b>
                </figcaption>
              </figure>
            )}
          </div>
          <p className="duel-score">
            {t('duel.score', { you: duel.you?.wins ?? 0, rival: duel.rival?.wins ?? 0 })}
            {!duel.matchDone && <span> · {t('duel.roundOf', { round: duel.round, best: duel.best })}</span>}
          </p>
          <div className="result-actions">
            {duel.matchDone ? (
              <button className="primary" onClick={onFinal} disabled={busy}>
                {t('duel.matchOver')}
              </button>
            ) : (
              <button className="primary" onClick={onNext} disabled={busy || duel.you?.wantsNext}>
                {duel.you?.wantsNext ? t('duel.nextWait') : t('duel.next')}
              </button>
            )}
          </div>
          {duel.rival?.wantsNext && !duel.you?.wantsNext && <p className="muted small">{t('duel.rivalWantsNext', { name: duel.rival.nickname })}</p>}
        </div>
      )}

      <ol className="who-grid" style={{ ['--board' as string]: duel.size ?? 5 }}>
        {cards.map((id) => {
          const entity = byId.get(id)
          if (!entity) return null
          const off = struck.has(id)
          return (
            <li key={id} className={off ? 'off' : ''}>
              <button
                type="button"
                className="who-card"
                aria-label={`${name(entity)} — ${off ? t('who.open') : t('who.close')}`}
                disabled={over || busy}
                onClick={() => pick(id)}
              >
                <span className="who-flip">
                  <span className="who-face who-front">
                    <img className="who-thumb" src={fullUrl(game.id, entity.id, entity.image)} alt="" loading="lazy" />
                    <span className="who-name">{name(entity)}</span>
                  </span>
                  <span className="who-face who-back" aria-hidden>
                    ?
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="who-info"
                aria-label={t('who.info')}
                tabIndex={off ? -1 : 0}
                onClick={() => setInfo(id)}
              >
                i
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
              <img className="who-modal-thumb" src={fullUrl(game.id, shown.id, shown.image)} alt="" />
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

      {ask !== null && answer && (
        <div className="modal-backdrop" onClick={() => setAsk(null)} role="presentation">
          <section className="card modal who-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label={t('profile.close')} onClick={() => setAsk(null)}>
              <CloseIcon />
            </button>
            <header className="who-modal-head">
              <img className="who-modal-thumb" src={fullUrl(game.id, answer.id, answer.image)} alt="" />
              <b>{name(answer)}</b>
            </header>
            <p className="who-warn">{t('who.lastWarn')}</p>
            <div className="who-ask">
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={() => {
                  onStrike(ask)
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
