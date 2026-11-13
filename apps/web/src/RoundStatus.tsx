import { useI18n } from './i18n'
import { isElsewhere } from './useRound'

type Props = { error: string | null; onRetry: () => void }

export default function RoundStatus({ error, onRetry }: Props) {
  const { t, error: errorText } = useI18n()
  if (error) {
    return (
      <div className="card round-status error">
        <span>{errorText(error)}</span>
        <button className={isElsewhere(error) ? 'primary' : 'ghost'} onClick={onRetry}>
          {error === 'elsewhere' ? t('play.takeOver') : error === 'elsewhere_daily' ? t('play.takeOverDaily') : t('play.retry')}
        </button>
      </div>
    )
  }
  return null
}
