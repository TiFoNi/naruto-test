type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  width: '1em',
  height: '1em',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <rect x="3" y="5.5" width="18" height="15" rx="3.5" />
      <path d="M3 10.5h18" />
      <path d="M8 3v4.5M16 3v4.5" />
      <circle cx="8.5" cy="15" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SwordsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <path d="M4 4 14.5 14.5" />
      <path d="M20 4 9.5 14.5" />
      <path d="M12.5 17.5 17.5 12.5" />
      <path d="M6.5 12.5 11.5 17.5" />
      <path d="M15.6 15.6 19 19" />
      <path d="M8.4 15.6 5 19" />
      <circle cx="19.9" cy="19.9" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.1" cy="19.9" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <path d="M7 4h10v5.5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4.5v1.5a3.5 3.5 0 0 0 3 3.46M17 5.5h2.5v1.5a3.5 3.5 0 0 1-3 3.46" />
      <path d="M12 14.5V18M8.5 20.5h7" />
    </svg>
  )
}

export function InfinityIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <path d="M12 12c-1.5-3-3-4-4.5-4C5.6 8 4 9.8 4 12s1.6 4 3.5 4c1.5 0 3-1 4.5-4 1.5-3 3-4 4.5-4 1.9 0 3.5 1.8 3.5 4s-1.6 4-3.5 4c-1.5 0-3-1-4.5-4Z" />
    </svg>
  )
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`} strokeWidth={2.4}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  )
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`} strokeWidth={2.2}>
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  )
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M3.5 9.5h17M3.5 15.5h17M9.5 3.5v17M15.5 3.5v17" />
    </svg>
  )
}

export function PictureIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <rect x="3" y="4.5" width="18" height="15" rx="3.2" />
      <circle cx="9" cy="10" r="1.9" />
      <path d="m4.5 17.5 4.2-4.2a2 2 0 0 1 2.8 0l3 3" />
      <path d="m14 15 1.6-1.6a2 2 0 0 1 2.8 0l1.4 1.4" />
    </svg>
  )
}

export function SparkIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <path d="M12 2.8c.6 4.6 2.6 6.6 7.2 7.2-4.6.6-6.6 2.6-7.2 7.2-.6-4.6-2.6-6.6-7.2-7.2 4.6-.6 6.6-2.6 7.2-7.2Z" />
      <path d="M18.5 16.2c.25 1.9 1.1 2.75 3 3-1.9.25-2.75 1.1-3 3-.25-1.9-1.1-2.75-3-3 1.9-.25 2.75-1.1 3-3Z" />
    </svg>
  )
}

export function PageIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <rect x="4.5" y="3" width="15" height="18" rx="2.5" />
      <path d="M8 7.5h8v5H8z" />
      <path d="M8 16h4.5M14.5 16H16" />
    </svg>
  )
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`} strokeWidth={2}>
      <path d="M5 20V11M12 20V5M19 20v-6" />
    </svg>
  )
}

export function MedalIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <path d="M8.5 3 11 9M15.5 3 13 9" />
      <circle cx="12" cy="15" r="6" />
      <path
        d="M12 11.6 12.85 13.83 15.23 13.95 13.38 15.45 14 17.75 12 16.45 10 17.75 10.62 15.45 8.77 13.95 11.15 13.83Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}

export function SortIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`} strokeWidth={2.4}>
      <path d="m7 10 5-5 5 5M7 14l5 5 5-5" />
    </svg>
  )
}
