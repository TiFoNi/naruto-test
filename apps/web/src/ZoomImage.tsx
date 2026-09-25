import { useEffect, useRef, useState } from 'react'
import type { Game } from './games/types'
import { useI18n } from './i18n'

const MAX_RETRIES = 3

export default function ZoomImage({ game, src, zoom, resetKey }: { game: Game; src?: string; zoom: number; resetKey?: string }) {
  const { t } = useI18n()
  const [loaded, setLoaded] = useState(false)
  const [retry, setRetry] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(timer.current)
    setLoaded(false)
    setRetry(0)
  }, [resetKey])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className={`zoom-frame ${game.wideImages ? 'wide' : ''}`}>
      {src && !loaded && <div className="zoom-loading">{t(retry > MAX_RETRIES ? 'image.failed' : 'image.loading')}</div>}
      {src && (
        <img
          key={`${src}-${retry}`}
          ref={(el) => {
            if (el?.complete && el.naturalWidth) setLoaded(true)
          }}
          src={retry ? `${src}&retry=${retry}` : src}
          crossOrigin="use-credentials"
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            clearTimeout(timer.current)
            timer.current = setTimeout(() => setRetry((r) => (r <= MAX_RETRIES ? r + 1 : r)), 800)
          }}
          style={{ opacity: loaded ? 1 : 0, transform: `scale(${zoom})` }}
        />
      )}
    </div>
  )
}
