import GameAccent from '@/src/GameAccent'
import QuizList from '@/src/QuizList'
import '@/src/styles/quiz.css'

type Params = { params: Promise<{ lang: string; game: string }> }

export default async function TestsPage({ params }: Params) {
  const { game } = await params
  return (
    <>
      <GameAccent game={game} />
      <QuizList game={game} />
    </>
  )
}
