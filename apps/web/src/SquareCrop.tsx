'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import { createPortal } from 'react-dom'

const BOX = 320
const OUT = 768
const MAX_ZOOM = 6

type Spot = { x: number; y: number }

type Props = { file: File; onCancel: () => void; onDone: (blob: Blob) => void }

export default function SquareCrop({ file, onCancel, onDone }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<Spot | null>(null)
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState(1)
  const [at, setAt] = useState<Spot>({ x: 0, y: 0 })
  const [failed, setFailed] = useState(false)

  const base = image ? BOX / Math.min(image.naturalWidth, image.naturalHeight) : 1

  const fit = useCallback(
    (spot: Spot, level: number): Spot => {
      if (!image) return spot
      const width = image.naturalWidth * base * level
      const height = image.naturalHeight * base * level
      return { x: Math.min(0, Math.max(BOX - width, spot.x)), y: Math.min(0, Math.max(BOX - height, spot.y)) }
    },
    [image, base],
  )

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const picture = new Image()
    picture.onload = () => {
      const scale = BOX / Math.min(picture.naturalWidth, picture.naturalHeight)
      setImage(picture)
      setZoom(1)
      setAt({ x: (BOX - picture.naturalWidth * scale) / 2, y: (BOX - picture.naturalHeight * scale) / 2 })
    }
    picture.onerror = () => setFailed(true)
    picture.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx || !image) return
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, BOX, BOX)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, at.x, at.y, image.naturalWidth * base * zoom, image.naturalHeight * base * zoom)
  }, [image, at, zoom, base])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const pointOf = (event: { clientX: number; clientY: number }): Spot => {
    const rect = canvas.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const ratio = BOX / rect.width
    return { x: (event.clientX - rect.left) * ratio, y: (event.clientY - rect.top) * ratio }
  }

  const zoomTo = (next: number, center: Spot) => {
    const level = Math.min(MAX_ZOOM, Math.max(1, next))
    const factor = level / zoom
    setZoom(level)
    setAt(fit({ x: center.x - (center.x - at.x) * factor, y: center.y - (center.y - at.y) * factor }, level))
  }

  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    const point = pointOf(event)
    drag.current = { x: point.x - at.x, y: point.y - at.y }
  }

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag.current) return
    const point = pointOf(event)
    setAt(fit({ x: point.x - drag.current.x, y: point.y - drag.current.y }, zoom))
  }

  const wheel = (event: WheelEvent<HTMLCanvasElement>) => zoomTo(zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), pointOf(event))

  const save = () => {
    if (!image) return
    const scale = base * zoom
    const out = document.createElement('canvas')
    out.width = OUT
    out.height = OUT
    const ctx = out.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, -at.x / scale, -at.y / scale, BOX / scale, BOX / scale, 0, 0, OUT, OUT)
    out.toBlob((blob) => (blob ? onDone(blob) : setFailed(true)), 'image/webp', 0.92)
  }

  return createPortal(
    <div className="modal-backdrop raised" onClick={onCancel} role="presentation">
      <section className="card modal square-crop" role="dialog" aria-modal="true" aria-label="Кадрирование" onClick={(event) => event.stopPropagation()}>
        <h2>Выбери квадрат</h2>
        <p className="muted">Тащи картинку мышью, колесом или ползунком — приближай.</p>
        {failed ? (
          <p className="square-crop-error">Не получилось открыть картинку</p>
        ) : (
          <canvas
            ref={canvas}
            width={BOX}
            height={BOX}
            className="square-crop-box"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={wheel}
          />
        )}
        <input
          type="range"
          className="square-crop-zoom"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          disabled={!image}
          onChange={(event) => zoomTo(Number(event.target.value), { x: BOX / 2, y: BOX / 2 })}
          aria-label="Приближение"
        />
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Отмена
          </button>
          <button type="button" className="primary" disabled={!image} onClick={save}>
            Сохранить
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
