import type { Metadata } from 'next'
import QuizMake from '@/src/QuizMake'
import '@/src/styles/quiz.css'
import '@/src/styles/quiz-builder.css'
import '@/src/styles/admin.css'

export const metadata: Metadata = { robots: { index: false, follow: false } }

type Props = { searchParams: Promise<{ id?: string; game?: string }> }

export default async function MakeTestPage({ searchParams }: Props) {
  const { id, game } = await searchParams
  return <QuizMake id={typeof id === 'string' ? id : undefined} game={typeof game === 'string' ? game : undefined} />
}
