import { notFound } from 'next/navigation'
import ChatTest from '@/src/ChatTest'

export default function ChatTestPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ChatTest />
}
