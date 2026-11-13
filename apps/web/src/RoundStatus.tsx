import { useI18n } from './i18n'
import { SwapIcon } from './icons'
import { isElsewhere } from './useRound'

type Props = { error: string | null; onRetry: () => void }

export default function RoundStatus({ error, onRetry }: Props) {
  const { t, error: errorText } = useI18n()
  if (isElsewhere(error)) {
    const daily = error === 'elsewhere_daily'
    return (
      <div className="card round-elsewhere">
        <span className="round-elsewhere-mark" aria-hidden>
          <SwapIcon />
        </span>
        <b>{t(daily ? 'play.elsewhereDailyTitle' : 'play.elsewhereTitle')}</b>
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
