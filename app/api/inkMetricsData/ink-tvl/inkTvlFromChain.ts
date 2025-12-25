const numOrNull = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function fetchChainTvlAnd24hChange(args: {
  chainName: string
  chainSlug: string
  revalidateSec?: number
}) {
  const { chainName, chainSlug, revalidateSec = 300 } = args

  // tvl value from chains list
  const chainsRes = await fetch('https://api.llama.fi/v2/chains', {
  cache: 'no-store',
})

  const chainsJson: any[] = chainsRes.ok ? await chainsRes.json() : []

  const inkRow =
    chainsJson.find(c => String(c?.name).toLowerCase() === chainName.toLowerCase()) ||
    chainsJson.find(c => String(c?.chain).toLowerCase() === chainName.toLowerCase()) ||
    chainsJson.find(c => String(c?.name).toLowerCase() === chainSlug.toLowerCase()) ||
    chainsJson.find(c => String(c?.chain).toLowerCase() === chainSlug.toLowerCase()) ||
    null

const tvl = numOrNull(inkRow?.tvl)

// prefer DefiLlama computed 1d change if available
const change1d = numOrNull((inkRow as any)?.change_1d)
if (change1d != null) {
  return { tvl, tvlChange24hPct: change1d }
}

  // tvl history for 24h change
  const tvlHistRes = await fetch(
  `https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(chainSlug)}`,
  { cache: 'no-store' }
)


  const tvlHist: Array<{ date: number; tvl: number }> = tvlHistRes.ok ? await tvlHistRes.json() : []

const last = tvlHist[tvlHist.length - 1]
let prev: { date: number; tvl: number } | undefined = undefined

if (last?.date != null) {
  const target = last.date - 86400
  let bestDiff = Number.POSITIVE_INFINITY

  for (let i = tvlHist.length - 2; i >= 0; i--) {
    const row = tvlHist[i]
    if (!row?.date) continue
    const diff = Math.abs(row.date - target)
    if (diff < bestDiff) {
      bestDiff = diff
      prev = row
    }
    // small optimization: once we pass the target by a lot, stop
    if (row.date < target && diff > bestDiff) break
  }
}

const tvlChange24hPct =
  last?.tvl != null && prev?.tvl != null && prev.tvl > 0
    ? ((last.tvl - prev.tvl) / prev.tvl) * 100
    : null



  return { tvl, tvlChange24hPct }
}
