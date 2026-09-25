import { useEffect, useState } from 'react'
import { useI18n } from './i18n'

export default function AbilityIcon({ src, resetKey, className }: { src?: string; resetKey?: string; className?: string }) {
  const { t } = useI18n()
  const [loaded, setLoaded] = useState<string | null>(null)

  useEffect(() => setLoaded(null), [resetKey])

  return (
    <div className={`ability-frame ${className ?? ''}`}>
      {src && loaded !== src && <div className="zoom-loading">{t('image.loading')}</div>}
      {src && (
        <img
          key={src}
          ref={(el) => {
            if (el?.complete && el.naturalWidth) setLoaded(src)
          }}
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(src)}
          style={{ opacity: loaded === src ? 1 : 0 }}
        />
      )}
    </div>
  )
}
