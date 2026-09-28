'use client'

import { useMemo, useState } from 'react'
import Thumb from './Thumb'
import type { Game } from './games/types'
import { useI18n } from './i18n'
import { CloseIcon } from './icons'
import type { DuelView } from './useDuel'

type Props = {
  game: Game
  duel: DuelView
  busy: boolean
  onStrike: (entityId: number) => void
}

export default function WhoBoard({ game, duel, busy, onStrike }: Props) {
  const { t, l, tv, lang, name } = useI18n()
  const [open, setOpen] = useState<number | null>(null)

  const byId = useMemo(() => new Map((game.entities ?? []).map((entity) => [entity.id, entity])), [game.entities])
  const struck = useMemo(() => new Set(duel.struck ?? []), [duel.struck])
  const cards = duel.cards ?? []
  const standing = cards.filter((id) => !struck.has(id))
  const mine = duel.secret !== undefined ? byId.get(duel.secret) : undefined
  const shown = open !== null ? byId.get(open) : undefined
  const closed = open !== null && struck.has(open)
  const last = !closed && standing.length === 2
  const over = duel.status !== 'playing'

  const traits = (entity: NonNullable<typeof shown>) =>
    game.columns.map((column) => ({ title: l(column.title), value: column.text(entity, { tv, lang }) }))

  return (
    <section className="who">
      <div className="who-top card">
        {mine && (
          <div className="who-mine">
            <span className="play-card-title">{t('who.yours')}</span>
            <div className="who-mine-card">
              <Thumb game={game} entity={mine} className="who-mine-thumb" />
              <b>{name(mine)}</b>
            </div>
          </div>
        )}
        <div className="who-copy">
          <p className="who-first">{duel.youFirst ? t('who.youFirst') : duel.first ? t('who.first', { name: duel.first }) : ''}</p>
          <p className="muted">{t('who.hint')}</p>
          <p className="who-counts">
            <em>
              {t('who.left')} <b>{standing.length}</b>
            </em>
            <em>
              {t('who.rivalLeft')} <b>{duel.rivalLeft ?? 0}</b>
            </em>
          </p>
        </div>
      </div>

      <ol className="who-grid" style={{ ['--board' as string]: duel.size ?? 5 }}>
        {cards.map((id) => {
          const entity = byId.get(id)
          if (!entity) return null
          return (
            <li key={id} className={struck.has(id) ? 'off' : ''}>
              <button type="button" onClick={() => setOpen(id)} disabled={busy && !over}>
                <Thumb game={game} entity={entity} className="who-thumb" />
                <span>{name(entity)}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {shown && (
        <div className="modal-backdrop" onClick={() => setOpen(null)} role="presentation">
          <section className="card modal who-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="modal-close" aria-label={t('profile.close')} onClick={() => setOpen(null)}>
              <CloseIcon />
            </button>
            <header className="who-modal-head">
              <Thumb game={game} entity={shown} className="who-modal-thumb" />
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
            {!over && (
              <>
                {last && <p className="who-warn">{t('who.lastWarn')}</p>}
                <button
                  type="button"
                  className={closed ? 'ghost' : 'primary'}
                  disabled={busy}
                  onClick={() => {
                    onStrike(shown.id)
                    setOpen(null)
                  }}
                >
                  {closed ? t('who.open') : last ? t('who.answer') : t('who.close')}
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
