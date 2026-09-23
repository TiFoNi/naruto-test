import { useState, type FormEvent } from 'react'
import { api } from './api'
import { useAuth } from './auth'
import { useI18n } from './i18n'
import { RANKED_ENABLED, RATING_STEP } from './rating'
import { href, navigate } from './router'
import { SwordsIcon } from './icons'

export default function DuelLobby() {
  const { t, error: errorText } = useI18n()
  const { duels } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ranked, setRanked] = useState(false)




  const create = async () => {
    setBusy(true)
    const { ok, data } = await api<{ duel?: { code: string }; error?: string }>('duel', { action: 'create', ranked: RANKED_ENABLED && ranked })
    setBusy(false)
    if (ok && data.duel) navigate(href.duel(data.duel.code))
    else setError(data.error ?? 'server')
  }

  const join = (e: FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (/^[A-Z0-9]{6}$/.test(clean)) navigate(href.duel(clean))
    else setError('not_found')
  }

  return (
    <div className="duels">
      <a className="back" href={href.home}>
        {t('play.back')}
      </a>
      <header className="lb-head">
        <h1>
          <SwordsIcon /> {t('duel.title')}
        </h1>
        <p className="muted">{t('duel.lead')}</p>
        <p className="muted small">{t('duel.rules')}</p>
      </header>

      <section className="card duel-create">
        <h2>{t('duel.create')}</h2>
        <p className="muted">{t('duel.createHint')}</p>

        <div className="variant-tabs duel-kind" role="tablist" aria-label={t('duel.kind')}>
          <button role="tab" type="button" aria-selected={!ranked} className={!ranked ? 'active' : ''} onClick={() => setRanked(false)}>
            {t('duel.casual')}
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={ranked}
            className={ranked ? 'active' : ''}
            disabled={!RANKED_ENABLED}
            title={RANKED_ENABLED ? undefined : t('duel.rankedSoon')}
            onClick={() => setRanked(true)}
          >
            {t('duel.ranked')}
            {!RANKED_ENABLED && <em className="soon-tag">{t('soon')}</em>}
          </button>
        </div>
        <p className="muted small">
          {!RANKED_ENABLED
            ? t('duel.rankedSoon')
            : t(ranked ? 'duel.rankedHint' : 'duel.casualHint', { step: RATING_STEP, rating: duels.rating })}
        </p>

        <button className="primary big" onClick={create} disabled={busy}>
          {busy ? t('duel.creating') : t('duel.create')}
        </button>
      </section>

      <form className="card duel-join" onSubmit={join}>
        <h2>{t('duel.joinTitle')}</h2>
        <div className="inline-field">
          <input value={code} maxLength={6} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className="primary" type="submit">
            {t('duel.join')}
          </button>
        </div>
      </form>

      {error && <div className="notice error">{errorText(error)}</div>}

    </div>
  )
}
