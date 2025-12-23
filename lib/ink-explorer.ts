export async function fetchTopHolders(tokenAddress: string) {
  const r = await fetch(`/api/explore/token-holders?token=${encodeURIComponent(tokenAddress)}`, {
    cache: 'no-store',
  })
  const j = await r.json()
  if (!j?.ok) throw new Error('holders fetch failed')
  return {
    supply: j.supply ?? null,
    holdersCount: j.holdersCount ?? null,
    holders: Array.isArray(j.holders) ? j.holders : [],
  }
}

export async function searchTokens(q: string) {
  const r = await fetch(`/api/explore/token-search?q=${encodeURIComponent(q)}`, { cache: 'no-store' })
  const j = await r.json()
  return Array.isArray(j?.items) ? j.items : []
}

export async function fetchTokenMeta(address: string) {
  const res = await fetch(
    `https://explorer.inkonchain.com/api/v2/tokens/${address}`
  )
  if (!res.ok) return null

  const j = await res.json()
  return {
    name: j.name ?? null,
    symbol: j.symbol ?? null,
    decimals: j.decimals ?? null,
  }
}
