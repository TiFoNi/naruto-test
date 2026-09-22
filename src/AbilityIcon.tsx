import { useEffect, useState } from 'react'
import { useI18n } from './i18n'

export default function AbilityIcon({ src, resetKey }: { src?: string; resetKey?: string }) {
  const { t } = useI18n()
  const [loaded, setLoaded] = useState<string | null>(null)

  useEffect(() => setLoaded(null), [resetKey])

  return (
    <div className="ability-frame">
      {src && loaded !== src && <div className="zoom-loading">{t('image.loading')}</div>}
      {src && <img key={src} src={src} alt="" draggable={false} onLoad={() => setLoaded(src)} style={{ opacity: loaded === src ? 1 : 0 }} />}
    </div>
  )
}
