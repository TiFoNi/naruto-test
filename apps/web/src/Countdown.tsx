import { useEffect, useState } from 'react'

const pad = (n: number) => String(n).padStart(2, '0')

export function formatLeft(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

export default function Countdown({ until, onDone }: { until: number; onDone?: () => void }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (now >= until) onDone?.()
  }, [now, until, onDone])

  return <b className="countdown">{formatLeft(until - now)}</b>
}
