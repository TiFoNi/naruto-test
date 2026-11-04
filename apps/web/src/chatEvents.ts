const OPEN = 'nanda:chat-open'

export type ChatOpen = { room: 'chat' | 'news'; line?: string }

export const openChat = (line?: string, room: ChatOpen['room'] = 'chat') =>
  window.dispatchEvent(new CustomEvent<ChatOpen>(OPEN, { detail: { room, line } }))

export const onChatOpen = (listen: (ask: ChatOpen) => void) => {
  const handle = (event: Event) => listen((event as CustomEvent<ChatOpen>).detail)
  window.addEventListener(OPEN, handle)
  return () => window.removeEventListener(OPEN, handle)
}
