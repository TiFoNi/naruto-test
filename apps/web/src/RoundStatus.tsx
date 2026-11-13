import { useI18n } from './i18n'
import { SwapIcon } from './icons'
import { isElsewhere, lastElsewhere } from './useRound'

type Props = { error: string | null; onRetry: () => void }

export default function RoundStatus({ error, onRetry }: Props) {
  const { t, error: errorText, lang } = useI18n()
  if (isElsewhere(error)) {
    const daily = error === 'elsewhere_daily'
    const where = lastElsewhere()
    return (
      <div className="card round-elsewhere">
        <span className="round-elsewhere-mark" aria-hidden>
          <SwapIcon />
        </span>
        <b>{t(daily ? 'play.elsewhereDailyTitle' : 'play.elsewhereTitle')}</b>
        {where && (
          <span className="round-elsewhere-where">
            {t('play.elsewhereWhere', { name: where.name ?? t('play.elsewhereUnknown'), at: new Date(where.at).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}
          </span>
        )}
        <p>{t(daily ? 'play.elsewhereDaily' : 'play.elsewhereHint')}</p>
        <button type="button" className="primary" onClick={onRetry}>
          {t(daily ? 'play.takeOverDaily' : 'play.takeOver')}
        </button>
      </div>
    )
  }
  if (error) {
    return (
      <div className="card round-status error">
        <span>{errorText(error)}</span>
        <button className="ghost" onClick={onRetry}>
          {t('play.retry')}
        </button>
      </div>
    )
  }
  return null
}
