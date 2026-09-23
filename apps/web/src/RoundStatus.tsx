import { useI18n } from './i18n'

type Props = { loading: boolean; error: string | null; onRetry: () => void }

export default function RoundStatus({ loading, error, onRetry }: Props) {
  const { t, error: errorText } = useI18n()
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
  return loading ? <div className="card round-status muted">{t('loading')}</div> : null
}
