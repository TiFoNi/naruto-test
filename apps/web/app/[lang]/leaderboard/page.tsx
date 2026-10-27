import SeasonBoard, { type Board } from '@/src/SeasonBoard'
import { apiAsUser } from '@/src/serverApi'

export default async function SeasonPage() {
  const initial = await apiAsUser<Board>('season')
  return <SeasonBoard initial={initial} />
}
