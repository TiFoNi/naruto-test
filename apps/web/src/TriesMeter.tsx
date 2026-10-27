import { useI18n } from './i18n'

export default function TriesMeter({ used, limit }: { used: number; limit: number }) {
  const { t } = useI18n()
  const left = Math.max(limit - used, 0)
  const low = left <= Math.max(2, Math.ceil(limit * 0.2))

  return (
    <span className={`play-tries ${low ? 'is-low' : ''}`} role="status">
      {t('tries.left')}: <b>{left}</b> / {limit}
    </span>
  )
}
