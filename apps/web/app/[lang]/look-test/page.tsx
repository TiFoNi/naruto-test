'use client'

import HeroPeek from '@/src/HeroPeek'
import type { User } from '@/src/auth'

const user = { id: 'x', username: 'tifoni', nickname: 'TiFoNi', tag: 'UN8WV', avatar: null, frame: 'kny', frames: [], banner: 'kny', banners: [], tone: null, nickTone: null, title: 'tester', xp: 54000 } as unknown as User

export default function Page() {
  return (
    <div className="profile" style={{ padding: 16, maxWidth: 1400, margin: '0 auto' }}>
      <HeroPeek user={user} stats={{ tiles: ['solved'], totals: { solved: 1657 } }} banner="kny" frame="kny" />
    </div>
  )
}
