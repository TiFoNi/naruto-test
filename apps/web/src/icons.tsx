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

export function TvIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <rect x="2.5" y="7" width="19" height="13" rx="3" />
      <path d="m8 3 4 4 4-4" />
    </svg>
  )
}

export function GamepadIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <rect x="2.5" y="7.5" width="19" height="10" rx="5" />
      <path d="M7 10.5v4M5 12.5h4" />
      <circle cx="16.4" cy="11.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="18.6" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <path d="M18 9a6 6 0 0 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10.3 19a2 2 0 0 0 3.4 0" />
    </svg>
  )
}

export function GiftIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <rect x="3" y="9.5" width="18" height="11" rx="2.5" />
      <path d="M2.5 9.5h19M12 9.5V20.5" />
      <path d="M12 9.5S10.4 4.2 8 4.2a2.4 2.4 0 0 0 0 4.8h4" />
      <path d="M12 9.5s1.6-5.3 4-5.3a2.4 2.4 0 0 1 0 4.8h-4" />
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

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`} strokeWidth={2.2}>
      <path d="m6 6 12 12M18 6 6 18" />
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

export function GoogleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="1.15em" height="1.15em" aria-hidden focusable="false" className={`icon ${className ?? ''}`}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.09A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  )
}
