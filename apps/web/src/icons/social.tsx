type IconProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  width: '1em',
  height: '1em',
  fill: 'currentColor',
  'aria-hidden': true,
  focusable: false,
} as const

export function TelegramIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <path d="M21.7 4.2 18.9 19c-.2 1-.8 1.2-1.6.8l-4.5-3.3-2.2 2.1c-.2.2-.5.5-1 .5l.3-4.6 8.3-7.5c.4-.3-.1-.5-.6-.2L7.4 13.2l-4.4-1.4c-1-.3-1-1 .2-1.4l17.2-6.6c.8-.3 1.5.2 1.3 1.4Z" />
    </svg>
  )
}

export function XIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <path d="M17.5 3h3.1l-6.8 7.7L21.8 21h-6.2l-4.9-6.3L5.1 21H2l7.2-8.2L2.5 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3Z" />
    </svg>
  )
}

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <path d="M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A9.9 9.9 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-3-.2-.3A8 8 0 1 1 12 20Zm4.5-5.9c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.3.1-.5.2-.7l.3-.5c.1-.2 0-.3 0-.5l-.7-1.6c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.4-.3Z" />
    </svg>
  )
}

export function RedditIcon({ className }: IconProps) {
  return (
    <svg {...base} className={`icon ${className ?? ''}`}>
      <path d="M22 12a2.2 2.2 0 0 0-3.7-1.6 10.8 10.8 0 0 0-5.5-1.7l.9-4.2 3 .6a1.8 1.8 0 1 0 .2-1.4l-3.6-.8c-.2 0-.4.1-.5.3l-1.1 5.5a10.8 10.8 0 0 0-5.5 1.7 2.2 2.2 0 1 0-2.4 3.6 4 4 0 0 0 0 .6c0 3.1 3.6 5.6 8 5.6s8-2.5 8-5.6a4 4 0 0 0 0-.6c.7-.4 1.2-1.1 1.2-2Zm-14 1.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0Zm8.4 4.2c-1 1-3.1 1.1-3.7 1.1s-2.7 0-3.7-1.1a.4.4 0 0 1 .6-.6c.7.7 2.1.9 3.1.9s2.4-.2 3.1-.9a.4.4 0 0 1 .6.6Zm-.4-2.7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
    </svg>
  )
}

export function ShareIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={`icon ${className ?? ''}`}
    >
      <path d="M12 3v12M12 3 8 7M12 3l4 4" />
      <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
    </svg>
  )
}
