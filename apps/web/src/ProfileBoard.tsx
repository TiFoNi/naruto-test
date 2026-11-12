'use client'

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import ReactGridLayout, { useContainerWidth, type Layout, type LayoutItem } from 'react-grid-layout'
import { gridBounds, transformStrategy } from 'react-grid-layout/core'
import type { ProfileBlock } from '@nanda/game'

const GAP = 14
const BAR = 40
const ROW = 4
const WIDE = 1000
const ACTIVITY_LIST = 260
const FREE_MIN = 150
const FREE_MAX = 900
const SHELVES: ProfileBlock[] = ['worlds', 'awards', 'cards']
const FULL = 2
const FULL_ROW = 8
const WIDEN = 36
const CELL_MAX = 200

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

type Metrics = {
  base: number
  step: number
  row: number
  gap: number
  cardRow: number
  cardW: number
  cardGap: number
  cardChrome: number
  cardBase: number
  cardStep: number
  activity: number
  facts: number
  quizzes: number
  worldCell: number
  awardCell: number
}

const FALLBACK: Metrics = {
  base: 246,
  step: 186,
  row: 170,
  gap: 16,
  cardRow: 170,
  cardW: 127,
  cardGap: 16,
  cardChrome: 36,
  cardBase: 246,
  cardStep: 186,
  activity: 337,
  facts: 123,
  quizzes: 176,
  worldCell: 0,
  awardCell: 0,
}

const unitsOf = (px: number) => Math.max(1, Math.round(px)) + GAP
const isShelf = (block: ProfileBlock) => SHELVES.includes(block)

const same = (one: Metrics, two: Metrics) => (Object.keys(one) as (keyof Metrics)[]).every((key) => Math.abs(one[key] - two[key]) < 1)

const zoomOf = () => parseFloat(getComputedStyle(document.body).zoom) || 1

const exact = (node: HTMLElement) => node.getBoundingClientRect().width / zoomOf()

const halfOf = (shelf: HTMLElement) => {
  const slot = shelf.closest<HTMLElement>('.profile-slot')
  const style = getComputedStyle(shelf)
  const width = exact(shelf) - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
  return slot?.classList.contains('is-full') ? width - (exact(slot) + GAP) / 2 : width
}

const cellOf = (shelf: HTMLElement | null) => {
  if (!shelf) return 0
  const style = getComputedStyle(shelf)
  const inner = halfOf(shelf) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  return Math.round(Math.min(CELL_MAX, (inner - (ROW - 1) * (parseFloat(style.columnGap) || 0)) / ROW) * 100) / 100
}

function measure(box: HTMLElement, wide: boolean): Metrics | null {
  const zoom = zoomOf()
  const shelfOf = (block: string, list: string) =>
    box.querySelector<HTMLElement>(`.profile-slot:not(.is-full).slot-${block} ${list}`) ?? box.querySelector<HTMLElement>(`.slot-${block} ${list}`)
  const awardShelf = shelfOf('awards', '.soon-badges')
  const worldShelf = shelfOf('worlds', '.world-shelf')
  const ref = awardShelf ?? worldShelf
  const cards = box.querySelector<HTMLElement>('.slot-cards .card-shelf')
  const listed = box.querySelector<HTMLElement>('.slot-activity .activity-card')
  const pick = (shelf: HTMLElement) => {
    const card = shelf.closest<HTMLElement>('.card')!
    const first = shelf.firstElementChild as HTMLElement | null
    const outer = getComputedStyle(card)
    const tail = parseFloat(outer.paddingBottom) + parseFloat(outer.borderBottomWidth)
    const top = (shelf.getBoundingClientRect().top - card.getBoundingClientRect().top) / zoom
    return { card, first, tail, top, gap: parseFloat(getComputedStyle(shelf).rowGap) || 0 }
  }
  const rowsOfShelf = (shelf: HTMLElement | null) => {
    if (!shelf) return null
    const seen = pick(shelf)
    if (!seen.first) return null
    const height = seen.first.offsetHeight
    return { base: Math.round(seen.top + height + seen.tail), step: height + seen.gap }
  }
  const worldRows = rowsOfShelf(worldShelf)
  const awardRows = rowsOfShelf(awardShelf)
  let base = 0
  let step = 0
  let row = 0
  let gap = 0
  if (ref) {
    const seen = pick(ref)
    if (!seen.first) return null
    row = seen.first.offsetHeight
    gap = seen.gap
    base = Math.max(worldRows?.base ?? 0, awardRows?.base ?? 0) || Math.round(seen.top + row + seen.tail)
    step = Math.max(worldRows?.step ?? 0, awardRows?.step ?? 0) || row + gap
  }
  let cardRow = row
  let cardW = 0
  let cardGap = gap
  let cardChrome = FALLBACK.cardChrome
  let cardBase = 0
  let cardStep = 0
  if (cards) {
    const seen = pick(cards)
    const outer = getComputedStyle(seen.card)
    const chrome = parseFloat(outer.paddingTop) + parseFloat(outer.borderTopWidth) + seen.tail
    const inner = getComputedStyle(cards)
    const column = (halfOf(cards) - parseFloat(inner.paddingLeft) - parseFloat(inner.paddingRight) - (ROW - 1) * (parseFloat(inner.columnGap) || 0)) / ROW
    const tallest = Math.floor(column / 0.75)
    if (!ref) {
      row = tallest
      gap = seen.gap
      base = Math.round(chrome + row)
      step = row + gap
    }
    cardRow = Math.max(30, wide ? Math.min(tallest, row) : tallest)
    cardW = Math.max(20, Math.floor(cardRow * 0.75))
    cardGap = wide ? Math.max(0, Math.round(step - cardRow)) : Math.round(gap)
    cardChrome = chrome
    cardBase = wide ? base : Math.round(chrome + cardRow)
    cardStep = wide ? step : cardRow + cardGap
  }
  if (!base) return null
  let activity = FALLBACK.activity
  if (listed) {
    const list = listed.querySelector<HTMLElement>('.activity, p')
    const outer = getComputedStyle(listed)
    const top = list?.getBoundingClientRect().top ?? listed.getBoundingClientRect().top
    const head = (top - listed.getBoundingClientRect().top) / zoom
    const last = list?.lastElementChild ?? list
    const content = last ? (last.getBoundingClientRect().bottom - top) / zoom + (list?.scrollTop ?? 0) : 0
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
  let quizzes = FALLBACK.quizzes
  const tested = box.querySelector<HTMLElement>('.slot-quizzes .profile-card')
  if (tested) {
    const kept = tested.style.cssText
    tested.style.flex = 'none'
    tested.style.height = 'auto'
    quizzes = Math.max(FALLBACK.quizzes, tested.offsetHeight)
    tested.style.cssText = kept
  }
  return {
    base,
    step,
    row,
    gap,
    cardRow,
    cardW,
    cardGap,
    cardChrome,
    cardBase: cardBase || base,
    cardStep: cardStep || step,
    activity,
    facts,
    quizzes,
    worldCell: cellOf(box.querySelector<HTMLElement>('.slot-worlds .world-shelf')),
    awardCell: cellOf(box.querySelector<HTMLElement>('.slot-awards .soon-badges')),
  }
}

export default function ProfileBoard({
  blocks,
  sides,
  seen,
  sizes,
  count,
  edit,
  content = '',
  render,
  onStart,
  onSave,
}: {
  blocks: ProfileBlock[]
  sides: Record<string, number>
  seen: Record<string, number>
  sizes: Record<string, number>
  count: (block: ProfileBlock, cols: number) => number | undefined
  edit: boolean
  content?: string
  render: (block: ProfileBlock, cols: number) => ReactNode
  onStart?: () => void
  onSave: (next: BoardSave) => void
}) {
  const [metrics, setMetrics] = useState<Metrics>(FALLBACK)
  const [zoom, setZoom] = useState(1)
  const placing = useMemo(() => ({ ...transformStrategy, scale: zoom }), [zoom])
  const { width, containerRef, mounted } = useContainerWidth()
  useLayoutEffect(() => setZoom(zoomOf()), [width])
  const wide = width >= WIDE
  const held = useRef(false)
  const [stretch, setStretch] = useState<{ block: ProfileBlock; px: number } | null>(null)
  const [span, setSpan] = useState<{ block: ProfileBlock; side: number } | null>(null)
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

  const sideOf = (block: ProfileBlock) => (span?.block === block ? span.side : (sides[block] ?? blocks.indexOf(block) % 2))
  const fullOf = (block: ProfileBlock) => wide && isShelf(block) && sideOf(block) === FULL
  const colsOf = (block: ProfileBlock) => (fullOf(block) ? FULL_ROW : ROW)
  const counts = blocks.map((block) => count(block, colsOf(block)) ?? '')

  const shape = `${width}|${edit}|${content}|${blocks.join()}|${counts.join()}|${JSON.stringify(sides)}|${metrics.worldCell}|${metrics.awardCell}`
  useLayoutEffect(() => {
    const box = containerRef.current
    if (!box || !mounted || held.current) return
    const next = measure(box, wide)
    if (next) setMetrics((was) => (same(next, was) ? was : next))
  }, [shape, mounted, containerRef])

  const most = (block: ProfileBlock) => Math.max(1, Math.ceil((count(block, colsOf(block)) ?? colsOf(block)) / colsOf(block)))
  const rowsOf = (block: ProfileBlock) => {
    const kept = seen[block]
    if (kept) return Math.min(most(block), Math.max(1, Math.ceil(kept / colsOf(block))))
    const px = sizes[block]
    if (px && block !== 'cards') return Math.min(most(block), Math.max(1, Math.round((px - baseOf(block)) / stepOf(block)) + 1))
    return block === 'cards' ? 1 : most(block)
  }
  const baseOf = (block: ProfileBlock) => (block === 'cards' ? metrics.cardBase : metrics.base)
  const stepOf = (block: ProfileBlock) => (block === 'cards' ? metrics.cardStep : metrics.step)
  const shelfPx = (rows: number, block: ProfileBlock) => baseOf(block) + (rows - 1) * stepOf(block)
  const rowsFor = (px: number, block: ProfileBlock) => Math.max(1, Math.round((px - baseOf(block)) / stepOf(block)) + 1)
  const bar = edit ? BAR : 0
  const heightOf = (block: ProfileBlock) => {
    if (stretch?.block === block) return unitsOf(stretch.px) + bar
    if (isShelf(block)) return unitsOf(shelfPx(rowsOf(block), block)) + bar
    if (block === 'facts' || block === 'quizzes') return unitsOf(Math.max(metrics.facts, blocks.includes('quizzes') ? metrics.quizzes : 0)) + bar
    return unitsOf(sizes[block] ?? metrics.activity) + bar
  }

  const tops = [0, 0]
  const layout: Layout = blocks.map((block) => {
    const full = fullOf(block)
    const x = wide && !full && sideOf(block) === 1 ? 1 : 0
    const h = heightOf(block)
    const y = full ? Math.max(tops[0]!, tops[1]!) : tops[x]!
    if (full) tops[0] = tops[1] = y + h
    else tops[x] = y + h
    return { i: block, x, y, w: full ? 2 : 1, h, isResizable: false }
  })

  const contentOf = (block: ProfileBlock) => {
    if (isShelf(block)) return shelfPx(rowsOf(block), block)
    return sizes[block] ?? metrics.activity
  }

  const grow = (block: ProfileBlock) => (event: ReactPointerEvent<HTMLElement>) => {
    if (!edit || event.button > 0) return
    event.preventDefault()
    event.stopPropagation()
    const from = event.clientY
    const base = contentOf(block)
    const stops = isShelf(block) ? Array.from({ length: most(block) }, (_, at) => shelfPx(at + 1, block)) : null
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
          seenNext[block] = rowsFor(px, block) * colsOf(block)
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

  const widen = (block: ProfileBlock, edge: 'left' | 'right') => (event: ReactPointerEvent<HTMLElement>) => {
    if (!edit || event.button > 0) return
    event.preventDefault()
    event.stopPropagation()
    const from = event.clientX
    const was = sides[block] ?? blocks.indexOf(block) % 2
    const pick = (dx: number) => {
      if (was !== FULL) return (was === 1 ? -dx : dx) > WIDEN ? FULL : was
      if (edge === 'right' && dx < -WIDEN) return 0
      if (edge === 'left' && dx > WIDEN) return 1
      return FULL
    }
    let side = was
    held.current = true
    onStart?.()
    setSpan({ block, side })
    const move = (next: PointerEvent) => {
      const value = pick(next.clientX - from)
      if (value === side) return
      side = value
      setSpan({ block, side })
    }
    const done = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', done)
      window.removeEventListener('pointercancel', done)
      held.current = false
      if (side !== was) onSave({ blocks, sides: { ...sides, [block]: side }, seen, sizes })
      setSpan(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', done)
    window.addEventListener('pointercancel', done)
  }

  const save = (next: Layout) => {
    held.current = false
    const sorted = [...next].sort((one, two) => one.y - two.y || one.x - two.x)
    const blocksNext = sorted.map((item) => item.i as ProfileBlock)
    const sidesNext = wide ? Object.fromEntries(next.map((item) => [item.i, item.w === 2 ? FULL : item.x])) : { ...sides }
    onSave({ blocks: blocksNext, sides: sidesNext, seen, sizes })
  }

  const vars = {
    '--card-row': `${metrics.cardRow}px`,
    '--card-w': `${metrics.cardW}px`,
    '--card-gap': `${metrics.cardGap}px`,
  } as CSSProperties
  const cardPad = (rows: number) => {
    const inner = shelfPx(rows, 'cards') - metrics.cardChrome
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
          positionStrategy={placing}
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
          {blocks.map((block) => {
            const rows = stretch?.block === block ? rowsFor(stretch.px, block) : rowsOf(block)
            const full = fullOf(block)
            const cell = block === 'worlds' ? metrics.worldCell : block === 'awards' ? metrics.awardCell : 0
            return (
              <div
                key={block}
                className={`profile-slot slot-${block} ${stretch?.block === block ? 'is-sized' : ''} ${full ? 'is-full' : ''} ${span?.block === block ? 'is-widening' : ''}`}
                data-block={block}
                data-shown={isShelf(block) ? rows * colsOf(block) : undefined}
                style={
                  {
                    ...(block === 'cards' ? { '--card-pad': `${cardPad(rows)}px` } : {}),
                    ...(cell ? { '--shelf-cell': `${cell}px` } : {}),
                  } as CSSProperties
                }
              >
                {render(block, colsOf(block))}
                {edit && block !== 'facts' && block !== 'quizzes' && <i className="slot-grow" onPointerDown={grow(block)} aria-hidden />}
                {edit && wide && isShelf(block) && (full || sideOf(block) === 1) && (
                  <i className="slot-widen is-left" onPointerDown={widen(block, 'left')} aria-hidden />
                )}
                {edit && wide && isShelf(block) && (full || sideOf(block) !== 1) && (
                  <i className="slot-widen is-right" onPointerDown={widen(block, 'right')} aria-hidden />
                )}
              </div>
            )
          })}
        </ReactGridLayout>
      )}
    </div>
  )
}
