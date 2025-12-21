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
    next: { revalidate: revalidateSec },
  })
  const chainsJson: any[] = chainsRes.ok ? await chainsRes.json() : []

  const inkRow =
    chainsJson.find(c => String(c?.name).toLowerCase() === chainName.toLowerCase()) ||
    chainsJson.find(c => String(c?.chain).toLowerCase() === chainName.toLowerCase()) ||
    chainsJson.find(c => String(c?.name).toLowerCase() === chainSlug.toLowerCase()) ||
    chainsJson.find(c => String(c?.chain).toLowerCase() === chainSlug.toLowerCase()) ||
    null

  const tvl = numOrNull(inkRow?.tvl)

  // tvl history for 24h change
  const tvlHistRes = await fetch(
    `https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(chainSlug)}`,
    { next: { revalidate: revalidateSec } }
  )

  const tvlHist: Array<{ date: number; tvl: number }> = tvlHistRes.ok ? await tvlHistRes.json() : []

  const last = tvlHist[tvlHist.length - 1]
  const prev = tvlHist[tvlHist.length - 2]

  const tvlChange24hPct =
    last?.tvl && prev?.tvl ? ((last.tvl - prev.tvl) / prev.tvl) * 100 : null

  return { tvl, tvlChange24hPct }
}
