import type { Metadata } from 'next'
import QuizAdmin from '@/src/QuizAdmin'
import '@/src/styles/admin.css'
import '@/src/styles/quiz.css'

export const metadata: Metadata = { title: 'Тесты', robots: { index: false, follow: false } }

export default function QuizAdminPage() {
  return <QuizAdmin />
}
