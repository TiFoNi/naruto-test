'use client'

import { useMemo, useState } from 'react'
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
}

export default function WhoBoard({ game, byId, duel, busy, onStrike }: Props) {
  const { t, l, tv, lang, name } = useI18n()
  const [info, setInfo] = useState<number | null>(null)
  const [ask, setAsk] = useState<number | null>(null)

  const struck = useMemo(() => new Set(duel.struck ?? []), [duel.struck])
  const cards = duel.cards ?? []
  const standing = cards.filter((id) => !struck.has(id))
  const mine = duel.secret !== undefined ? byId.get(duel.secret) : undefined
  const shown = info !== null ? byId.get(info) : undefined
  const over = duel.status !== 'playing'
  const answer = ask !== null ? byId.get(standing.find((id) => id !== ask) ?? -1) : undefined

  const traits = (entity: NonNullable<typeof shown>) =>
    game.columns.map((column) => ({ title: l(column.title), value: column.text(entity, { tv, lang }) }))

  const pick = (id: number) => {
    if (struck.has(id) || standing.length > 2) return onStrike(id)
    setAsk(id)
  }

  return (
    <section className="who">
      <div className="who-top card">
        {mine && (
          <div className="who-mine">
            <span className="play-card-title">{t('who.yours')}</span>
            <div className="who-mine-card">
              <img className="who-mine-thumb" src={fullUrl(game.id, mine.id, mine.image)} alt="" loading="lazy" />
              <b>{name(mine)}</b>
            </div>
          </div>
        )}
        <div className="who-copy">
          <p className="who-first">{duel.youFirst ? t('who.youFirst') : duel.first ? t('who.first', { name: duel.first }) : ''}</p>
          <p className="muted">{t('who.hint')}</p>
        </div>
      </div>

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
                {off ? (
                  <span className="who-back" aria-hidden>
                    ?
                  </span>
                ) : (
                  <>
                    <img className="who-thumb" src={fullUrl(game.id, entity.id, entity.image)} alt="" loading="lazy" />
                    <span className="who-name">{name(entity)}</span>
                  </>
                )}
              </button>
              {!off && (
                <button type="button" className="who-info" aria-label={t('who.info')} onClick={() => setInfo(id)}>
                  i
                </button>
              )}
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
