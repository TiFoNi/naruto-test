import GameAccent from '@/src/GameAccent'
import QuizPlay from '@/src/QuizPlay'
import '@/src/styles/quiz.css'

type Params = { params: Promise<{ lang: string; game: string; id: string }> }

export default async function TestPage({ params }: Params) {
  const { game, id } = await params
  return (
    <>
      <GameAccent game={game} />
      <QuizPlay game={game} id={id} />
    </>
  )
}
