import QuizList from '@/src/QuizList'
import '@/src/styles/quiz.css'
import '@/src/styles/quiz-builder.css'

type Params = { params: Promise<{ lang: string; category: string }> }

export default async function CategoryTestsPage({ params }: Params) {
  const { category } = await params
  return <QuizList category={category} />
}
