import type { Metadata } from 'next'
import QuizMine from '@/src/QuizMine'
import '@/src/styles/quiz.css'
import '@/src/styles/quiz-builder.css'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function MyTestsPage() {
  return <QuizMine />
}
