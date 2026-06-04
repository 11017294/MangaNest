const DAY_MS = 24 * 60 * 60 * 1000

export const calculateRankingScore = (comic, now = new Date()) => {
  const readCount = Number(comic.readCount || 0)
  const readScore = Math.log(readCount + 1) * 45
  const favoriteScore = comic.favorite ? 80 : 0

  let recentScore = 0
  if (comic.lastReadAt) {
    const lastReadTime = new Date(comic.lastReadAt).getTime()
    if (!Number.isNaN(lastReadTime)) {
      const daysSinceRead = Math.max(0, (now.getTime() - lastReadTime) / DAY_MS)
      recentScore = 55 / (1 + daysSinceRead / 14)
    }
  }

  return Math.round((readScore + favoriteScore + recentScore) * 100) / 100
}

export const sortRankedComics = (comics, now = new Date()) => {
  return [...comics]
    .map((comic) => ({
      ...comic,
      rankingScore: calculateRankingScore(comic, now)
    }))
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore

      const bLast = b.lastReadAt ? new Date(b.lastReadAt).getTime() : 0
      const aLast = a.lastReadAt ? new Date(a.lastReadAt).getTime() : 0
      if (bLast !== aLast) return bLast - aLast

      if ((b.readCount || 0) !== (a.readCount || 0)) return (b.readCount || 0) - (a.readCount || 0)
      return String(a.title || '').localeCompare(String(b.title || ''), undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    })
}
