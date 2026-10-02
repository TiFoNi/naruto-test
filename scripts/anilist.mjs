const API = 'https://graphql.anilist.co'

const QUERY = `query($id:Int,$page:Int){
  Media(id:$id){
    characters(page:$page, perPage:50, sort:[FAVOURITES_DESC]){
      pageInfo{ hasNextPage }
      edges{ node{ name{ full alternative } image{ large } } }
    }
  }
}`

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

async function request(id, page) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { id, page } }),
    })
    if (response.status === 429) {
      await sleep(Number(response.headers.get('retry-after') ?? 60) * 1000)
      continue
    }
    const body = await response.json()
    if (body.data?.Media) return body.data.Media.characters
    await sleep(2000)
  }
  throw new Error(`anilist: не вдалося отримати ${id}`)
}

export const bare = (name) => name.replace(/\s*[([].*$/, '').trim()

export const nameKey = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/ou|oo/g, 'o')
    .replace(/uu/g, 'u')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ')

export async function anilistPictures(mediaIds) {
  const pictures = new Map()
  for (const id of mediaIds) {
    for (let page = 1; ; page++) {
      const { pageInfo, edges } = await request(id, page)
      for (const { node } of edges) {
        const image = node.image?.large
        if (!image || /default\.jpg$/.test(image)) continue
        for (const name of [node.name.full, ...(node.name.alternative ?? [])]) {
          if (!name) continue
          for (const key of [nameKey(name), nameKey(bare(name))]) {
            if (key && !pictures.has(key)) pictures.set(key, image)
          }
        }
      }
      if (!pageInfo.hasNextPage) break
      await sleep(800)
    }
    await sleep(800)
  }
  return pictures
}
