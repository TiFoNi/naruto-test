'use client'

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const START_PX = 6
const SLIDE_MS = 220

type Grab = { id: string; pointer: number; x: number; y: number; dx: number; dy: number; live: boolean }

export function useShelfSort<T>(items: T[], keyOf: (item: T) => string, enabled: boolean, commit: (next: T[]) => void) {
  const [order, setOrder] = useState<string[] | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const list = useRef<HTMLUListElement>(null)
  const before = useRef<Map<string, DOMRect> | null>(null)
  const grab = useRef<Grab | null>(null)
  const pointer = useRef({ x: 0, y: 0 })

  const keys = items.map(keyOf)
  const current = order && order.length === keys.length && order.every((one) => keys.includes(one)) ? order : keys
  const byKey = new Map(items.map((item) => [keyOf(item), item]))
  const sorted = current.map((one) => byKey.get(one)!).filter(Boolean)

  const nodeOf = (id: string) => list.current?.querySelector<HTMLElement>(`:scope > [data-sort="${CSS.escape(id)}"]`) ?? null

  const spot = () => {
    const held = grab.current
    const node = held ? nodeOf(held.id) : null
    const box = list.current?.getBoundingClientRect()
    const card = list.current?.closest('.card')?.getBoundingClientRect()
    if (!held || !node || !box || !list.current) return null
    const pad = getComputedStyle(list.current)
    const frame = {
      left: box.left + parseFloat(pad.paddingLeft),
      right: box.right - parseFloat(pad.paddingRight),
      top: box.top + parseFloat(pad.paddingTop),
      bottom: Math.min(box.bottom - parseFloat(pad.paddingBottom), card ? card.bottom - parseFloat(getComputedStyle(list.current.closest('.card')!).paddingBottom) : Infinity),
    }
    const width = node.offsetWidth
    const height = node.offsetHeight
    const left = Math.min(Math.max(pointer.current.x - held.dx, frame.left), Math.max(frame.left, frame.right - width))
    const top = Math.min(Math.max(pointer.current.y - held.dy, frame.top), Math.max(frame.top, frame.bottom - height))
    return { node, box, left, top, x: left + width / 2, y: top + height / 2 }
  }

  const follow = () => {
    const at = spot()
    if (!at) return
    at.node.style.translate = `${at.left - (at.box.left + at.node.offsetLeft)}px ${at.top - (at.box.top + at.node.offsetTop)}px`
  }

  useLayoutEffect(() => {
    const was = before.current
    before.current = null
    follow()
    if (!was) return
    for (const [id, rect] of was) {
      if (id === grab.current?.id) continue
      const node = nodeOf(id)
      if (!node) continue
      const now = node.getBoundingClientRect()
      const dx = rect.left - now.left
      const dy = rect.top - now.top
      if (dx || dy) node.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: SLIDE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    }
  })

  const remember = () => {
    const map = new Map<string, DOMRect>()
    for (const id of current) {
      const node = nodeOf(id)
      if (node) map.set(id, node.getBoundingClientRect())
    }
    before.current = map
  }

  const handle = (id: string) => ({
    'data-sort': id,
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button > 0 || (event.target as Element).closest('button')) return
      const node = event.currentTarget
      const rect = node.getBoundingClientRect()
      grab.current = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY, dx: event.clientX - rect.left, dy: event.clientY - rect.top, live: false }
      pointer.current = { x: event.clientX, y: event.clientY }
      let working = [...current]

      const move = (moved: PointerEvent) => {
        const held = grab.current
        if (!held || moved.pointerId !== held.pointer) return
        pointer.current = { x: moved.clientX, y: moved.clientY }
        if (!held.live) {
          if (Math.hypot(moved.clientX - held.x, moved.clientY - held.y) < START_PX) return
          held.live = true
          setDragging(id)
        }
        moved.preventDefault()
        const at = spot()
        const target = at
          ? working.find((one) => {
              const other = one === id ? null : nodeOf(one)
              if (!other) return false
              const left = at.box.left + other.offsetLeft
              const top = at.box.top + other.offsetTop
              return at.x >= left && at.x <= left + other.offsetWidth && at.y >= top && at.y <= top + other.offsetHeight
            })
          : undefined
        if (target) {
          const from = working.indexOf(id)
          const to = working.indexOf(target)
          if (from !== to) {
            remember()
            working = [...working]
            working.splice(from, 1)
            working.splice(to, 0, id)
            setOrder(working)
            return
          }
        }
        follow()
      }

      const drop = (ended: PointerEvent) => {
        const held = grab.current
        if (!held || ended.pointerId !== held.pointer) return
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', drop)
        window.removeEventListener('pointercancel', drop)
        grab.current = null
        const node = nodeOf(id)
        if (held.live && node) {
          const from = node.style.translate || '0 0'
          node.style.translate = ''
          node.animate([{ translate: from }, { translate: '0 0' }], { duration: SLIDE_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
          const swallow = (click: MouseEvent) => {
            click.preventDefault()
            click.stopPropagation()
          }
          window.addEventListener('click', swallow, { capture: true, once: true })
          window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
        }
        setDragging(null)
        if (held.live && working.join() !== keys.join()) commit(working.map((one) => byKey.get(one)!).filter(Boolean))
        setOrder(null)
      }

      window.addEventListener('pointermove', move, { passive: false })
      window.addEventListener('pointerup', drop)
      window.addEventListener('pointercancel', drop)
    },
  })

  return { sorted, list, handle, dragging }
}
