import { useEffect, useState } from 'react'
import CharacterSearch from './CharacterSearch'
import { api } from './api'
import type { Entity, Game } from './games/types'
import { useI18n } from './i18n'
import type { ModeId } from './modes'
import { useHref } from './router'
import { CloseIcon, SwordsIcon } from './icons'

export default function ChallengeMaker({ game, mode }: { game: Game; mode: ModeId }) {
  const { t, name, error: errorText } = useI18n()
  const href = useHref()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [picked, setPicked] = useState<Entity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const create = async (entity: Entity) => {
    setBusy(true)
    setError(null)
    setPicked(entity)
    const { ok, data } = await api<{ challenge?: { code: string }; error?: string }>('challenge', {
      action: 'create',
      game: game.id,
      mode,
      answerId: entity.id,
    })
    setBusy(false)
    if (ok && data.challenge) setLink(`${window.location.origin}/${href.challenge(data.challenge.code)}`)
    else setError(data.error ?? 'server')
  }

  const copy = () => {
    navigator.clipboard?.writeText(link ?? '').then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => setCopied(false),
    )
  }

  const reset = () => {
    setLink(null)
    setPicked(null)
    setError(null)
  }

  return (
    <>
      <button className="lb-link challenge-open" onClick={() => setOpen(true)}>
        <SwordsIcon /> {t('challenge.button')}
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)} role="presentation">
          <section
            className="card modal challenge-maker"
            role="dialog"
            aria-modal="true"
            aria-label={t('challenge.title')}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setOpen(false)} aria-label={t('challenge.close')}>
              <CloseIcon />
            </button>
            <h2>{t('challenge.title')}</h2>
            <p className="muted">{t('challenge.hint')}</p>

            {link ? (
              <>
                <p className="challenge-picked">
                  {t('challenge.pick')}: <b>{picked ? name(picked) : ''}</b>
                </p>
                <div className="inline-field">
                  <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                  <button className="primary" onClick={copy}>
                    {copied ? t('duel.copied') : t('duel.copy')}
                  </button>
                </div>
                <button className="link-button" onClick={reset}>
                  {t('challenge.again')}
                </button>
              </>
            ) : (
              <CharacterSearch game={game} exclude={new Set()} active busy={busy} onPick={create} />
            )}

            {error && <div className="notice error">{errorText(error)}</div>}
          </section>
        </div>
      )}
    </>
  )
}
