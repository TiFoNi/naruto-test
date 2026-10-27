import { preload } from 'react-dom'
import SeasonBoard, { type Board } from '@/src/SeasonBoard'
import { BOARD_SIZES, bannerPic, bannerSet, isLive } from '@/src/banners'
import { apiAsUser } from '@/src/serverApi'

export default async function SeasonPage() {
  const initial = await apiAsUser<Board>('season')
  const top = initial?.rows[0]?.banner
  if (top && isLive(top)) preload(bannerPic(top), { as: 'image', fetchPriority: 'high' })
  else if (top) preload(bannerPic(top, true), { as: 'image', fetchPriority: 'high', imageSrcSet: bannerSet(top), imageSizes: BOARD_SIZES.first })
  return <SeasonBoard initial={initial} />
}
