'use client'

import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import ReactGridLayout, { useContainerWidth, type Layout, type LayoutItem } from 'react-grid-layout'
import { gridBounds } from 'react-grid-layout/core'
import type { ProfileBlock } from '@nanda/game'

const GAP = 14
const BAR = 40
const ROW = 4
const WIDE = 1000
const ACTIVITY_LIST = 260
const FREE_MIN = 150
const FREE_MAX = 900
const SHELVES: ProfileBlock[] = ['worlds', 'awards', 'cards']

type Constraint = NonNullable<LayoutItem['constraints']>[number]

const midway: Constraint = {
  name: 'midway',
  constrainPosition: (item, x, y, context) => {
    const hit = context.layout.find((one) => one.i !== item.i && one.x === x && y > one.y && y < one.y + one.h / 2)
    return { x, y: hit ? hit.y : y }
  },
}

const nearest = (list: number[], asked: number) => list.reduce((best, one) => (Math.abs(one - asked) < Math.abs(best - asked) ? one : best))

export type BoardSave = { blocks: ProfileBlock[]; sides: Record<string, number>; seen: Record<string, number>; sizes: Record<string, number> }

type Metrics = { base: number; step: number; row: number; gap: number; cardRow: number; cardW: number; cardGap: number; cardChrome: number; activity: number; facts: number }

const FALLBACK: Metrics = { base: 246, step: 186, row: 170, gap: 16, cardRow: 170, cardW: 127, cardGap: 16, cardChrome: 36, activity: 337, facts: 123 }

const unitsOf = (px: number) => Math.max(1, Math.round(px)) + GAP
const isShelf = (block: ProfileBlock) => SHELVES.includes(block)

const same = (one: Metrics, two: Metrics) => (Object.keys(one) as (keyof Metrics)[]).every((key) => Math.abs(one[key] - two[key]) < 1)

function measure(box: HTMLElement): Metrics | null {
  const ref = box.querySelector<HTMLElement>('.slot-awards .soon-badges, .slot-worlds .world-shelf')
  const cards = box.querySelector<HTMLElement>('.slot-cards .card-shelf')
  const listed = box.querySelector<HTMLElement>('.slot-activity .activity-card')
  const pick = (shelf: HTMLElement) => {
    const card = shelf.closest<HTMLElement>('.card')!
    const first = shelf.firstElementChild as HTMLElement | null
    const outer = getComputedStyle(card)
    const tail = parseFloat(outer.paddingBottom) + parseFloat(outer.borderBottomWidth)
    const top = shelf.getBoundingClientRect().top - card.getBoundingClientRect().top
    return { card, first, tail, top, gap: parseFloat(getComputedStyle(shelf).rowGap) || 0 }
  }
  let base = 0
  let step = 0
  let row = 0
  let gap = 0
  if (ref) {
    const seen = pick(ref)
    if (!seen.first) return null
    row = seen.first.offsetHeight
    gap = seen.gap
    base = Math.round(seen.top + row + seen.tail)
    step = row + gap
  }
  let cardRow = row
  let cardW = 0
  let cardGap = gap
  let cardChrome = FALLBACK.cardChrome
  if (cards) {
    const seen = pick(cards)
    const outer = getComputedStyle(seen.card)
    const chrome = parseFloat(outer.paddingTop) + parseFloat(outer.borderTopWidth) + seen.tail
    const inner = getComputedStyle(cards)
    const column = (cards.clientWidth - parseFloat(inner.paddingLeft) - parseFloat(inner.paddingRight) - (ROW - 1) * (parseFloat(inner.columnGap) || 0)) / ROW
    const tallest = Math.floor(column / 0.75)
    if (!ref) {
      row = tallest
      gap = seen.gap
      base = Math.round(chrome + row)
      step = row + gap
    }
    cardRow = Math.max(30, Math.min(tallest, row))
    cardW = Math.max(20, Math.floor(cardRow * 0.75))
    cardGap = Math.max(0, Math.round(step - cardRow))
    cardChrome = chrome
  }
  if (!base) return null
  let activity = FALLBACK.activity
  if (listed) {
    const list = listed.querySelector<HTMLElement>('.activity, p')
    const outer = getComputedStyle(listed)
    const top = list?.getBoundingClientRect().top ?? listed.getBoundingClientRect().top
    const head = top - listed.getBoundingClientRect().top
    const last = list?.lastElementChild ?? list
    const content = last ? last.getBoundingClientRect().bottom - top + (list?.scrollTop ?? 0) : 0
    const cap = list?.classList.contains('activity') ? ACTIVITY_LIST : content
    activity = Math.round(head + Math.min(content, cap) + parseFloat(outer.paddingBottom) + parseFloat(outer.borderBottomWidth))
  }
  let facts = Math.round(base / 2)
  const told = box.querySelector<HTMLElement>('.slot-facts .profile-card')
  if (told) {
    const kept = told.style.cssText
    told.style.flex = 'none'
    told.style.height = 'auto'
    facts = Math.max(facts, told.offsetHeight)
    told.style.cssText = kept
  }
  return { base, step, row, gap, cardRow, cardW, cardGap, cardChrome, activity, facts }
}

export default function ProfileBoard({
  blocks,
  sides,
  seen,
  sizes,
  counts,
  edit,
  render,
  onStart,
  onSave,
}: {
  blocks: ProfileBlock[]
  sides: Record<string, number>
  seen: Record<string, number>
  sizes: Record<string, number>
  counts: Partial<Record<ProfileBlock, number>>
  edit: boolean
  render: (block: ProfileBlock) => ReactNode
  onStart?: () => void
  onSave: (next: BoardSave) => void
}) {
  const { width, containerRef, mounted } = useContainerWidth()
  const [metrics, setMetrics] = useState<Metrics>(FALLBACK)
  const wide = width >= WIDE
  const held = useRef(false)
  const [stretch, setStretch] = useState<{ block: ProfileBlock; px: number } | null>(null)
  const [moving, setMoving] = useState(false)
  const [, setTick] = useState(0)
  const settle = useRef(0)
  const start = () => {
    held.current = true
    window.clearTimeout(settle.current)
    setMoving(true)
    onStart?.()
  }
  const stop = () => {
    settle.current = window.setTimeout(() => setMoving(false), 260)
  }

  const shape = `${width}|${edit}|${blocks.join()}|${JSON.stringify(counts)}`
  useLayoutEffect(() => {
    const box = containerRef.current
    if (!box || !mounted || held.current) return
    const next = measure(box)
    if (next) setMetrics((was) => (same(next, was) ? was : next))
  }, [shape, mounted, containerRef])

  const most = (block: ProfileBlock) => Math.max(1, Math.ceil((counts[block] ?? ROW) / ROW))
  const rowsOf = (block: ProfileBlock) => {
    const kept = seen[block]
    if (kept) return Math.min(most(block), Math.max(1, Math.ceil(kept / ROW)))
    const px = sizes[block]
    if (px && block !== 'cards') return Math.min(most(block), Math.max(1, Math.round((px - metrics.base) / metrics.step) + 1))
    return block === 'cards' ? 1 : most(block)
  }
  const shelfPx = (rows: number) => metrics.base + (rows - 1) * metrics.step
  const rowsFor = (px: number) => Math.max(1, Math.round((px - metrics.base) / metrics.step) + 1)
  const bar = edit ? BAR : 0
  const heightOf = (block: ProfileBlock) => {
    if (stretch?.block === block) return unitsOf(stretch.px) + bar
    if (isShelf(block)) return unitsOf(shelfPx(rowsOf(block))) + bar
    if (block === 'facts') return unitsOf(metrics.facts) + bar
    return unitsOf(sizes[block] ?? metrics.activity) + bar
  }

  const tops = [0, 0]
  const layout: Layout = blocks.map((block, index) => {
    const x = wide ? (sides[block] ?? index % 2) : 0
    const h = heightOf(block)
    const y = tops[x]!
    tops[x] = y + h
    return { i: block, x, y, w: 1, h, isResizable: false }
  })

  const contentOf = (block: ProfileBlock) => {
    if (isShelf(block)) return shelfPx(rowsOf(block))
    return sizes[block] ?? metrics.activity
  }

  const grow = (block: ProfileBlock) => (event: ReactPointerEvent<HTMLElement>) => {
    if (!edit || event.button > 0) return
    event.preventDefault()
    event.stopPropagation()
    const from = event.clientY
    const base = contentOf(block)
    const stops = isShelf(block) ? Array.from({ length: most(block) }, (_, at) => shelfPx(at + 1)) : null
    const pick = (y: number) => {
      const asked = base + y - from
      return stops ? nearest(stops, asked) : Math.round(Math.min(FREE_MAX, Math.max(FREE_MIN, asked)))
    }
    let px = base
    start()
    setStretch({ block, px })
    const move = (next: PointerEvent) => {
      const value = pick(next.clientY)
      if (value === px) return
      px = value
      setStretch({ block, px })
    }
    const done = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', done)
      held.current = false
      stop()
      if (px !== base) {
        const seenNext = { ...seen }
        const sizesNext = { ...sizes }
        if (isShelf(block)) {
          seenNext[block] = rowsFor(px) * ROW
          delete sizesNext[block]
        } else sizesNext[block] = px
        onSave({ blocks, sides, seen: seenNext, sizes: sizesNext })
      }
      setStretch(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', done)
    window.addEventListener('pointercancel', done)
  }

  const save = (next: Layout) => {
    held.current = false
    const sorted = [...next].sort((one, two) => one.y - two.y || one.x - two.x)
    const blocksNext = sorted.map((item) => item.i as ProfileBlock)
    const sidesNext = wide ? Object.fromEntries(next.map((item) => [item.i, item.x])) : { ...sides }
    onSave({ blocks: blocksNext, sides: sidesNext, seen, sizes })
  }

  const vars = {
    '--card-row': `${metrics.cardRow}px`,
    '--card-w': `${metrics.cardW}px`,
    '--card-gap': `${metrics.cardGap}px`,
  } as CSSProperties
  const cardPad = (rows: number) => {
    const inner = shelfPx(rows) - metrics.cardChrome
    return Math.max(0, (inner - rows * metrics.cardRow - (rows - 1) * metrics.cardGap) / 2)
  }

  return (
    <div ref={containerRef} className={`profile-grid ${edit ? 'is-edit' : ''} ${moving ? 'is-moving' : ''}`} style={vars}>
      {mounted && (
        <ReactGridLayout
          key={wide ? 'wide' : 'narrow'}
          width={width}
          layout={layout}
          gridConfig={{ cols: wide ? 2 : 1, rowHeight: 1, margin: [GAP, 0], containerPadding: [0, 0] }}
          dragConfig={{ enabled: edit, handle: '.slot-bar', cancel: '.slot-off', threshold: 4 }}
          constraints={[midway, gridBounds]}
          resizeConfig={{ enabled: false }}
          onDragStart={start}
          onDrag={() => setTick((was) => was + 1)}
          onDragStop={(next) => {
            stop()
            save(next)
          }}
        >
          {blocks.map((block) => (
            <div
              key={block}
              className={`profile-slot slot-${block} ${stretch?.block === block ? 'is-sized' : ''}`}
              data-block={block}
              data-rows={isShelf(block) ? (stretch?.block === block ? rowsFor(stretch.px) : rowsOf(block)) : undefined}
              style={
                {
                  ...(block === 'cards' ? { '--card-pad': `${cardPad(stretch?.block === block ? rowsFor(stretch.px) : rowsOf(block))}px` } : {}),
                } as CSSProperties
              }
            >
              {render(block)}
              {edit && block !== 'facts' && <i className="slot-grow" onPointerDown={grow(block)} aria-hidden />}
            </div>
          ))}
        </ReactGridLayout>
      )}
    </div>
  )
}
