import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type DexPair = {
  chainId?: string
  pairAddress?: string
  url?: string
  priceUsd?: string
  fdv?: number
  marketCap?: number
  liquidity?: { usd?: number }
  volume?: { h24?: number }
  baseToken?: { address?: string; name?: string; symbol?: string }
  info?: { imageUrl?: string }
}

type TokenRow = {
  address: string
  name: string
  symbol: string
  price: number
  mcap: number
  holders: number | null
  liquidity: number
  volume24h: number
  logo?: string
  pairUrl?: string
  pairAddress?: string
}

const API = 'https://api.dexscreener.com/latest/dex/search?q='
const DEX_TOKENS_V1 = 'https://api.dexscreener.com/tokens/v1/'
const CHAIN_ID = 'ink'

const EXPLORER_TOKENS_API = 'https://explorer.inkonchain.com/api/v2/tokens'
const INKYPUMP_TOKENS_API = 'https://inkypump.com/api/tokens'


const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const pickMcap = (p: DexPair) => {
  const mc = typeof p.marketCap === 'number' ? p.marketCap : 0
  const fdv = typeof p.fdv === 'number' ? p.fdv : 0
  return mc > 0 ? mc : fdv
}

const scorePair = (p: DexPair) => {
  const liq = toNum(p?.liquidity?.usd)
  const vol = toNum(p?.volume?.h24)
  return liq * 1_000_000 + vol
}

const isBadToken = (sym: string, name = '') => {
  const s = (sym || '').toUpperCase()
  const n = (name || '').toUpperCase()

  // obvious scam / junk
  if (
    s.includes('TELEGRAM') ||
    s.includes('TRON') ||
    s.includes('VIP') ||
    s.includes('HTTP') ||
    s.includes('HTTPS') ||
    n.includes('TELEGRAM') ||
    n.includes('TRON') ||
    n.includes('VIP')
  ) return true

  // base assets & stables
  if (
    s === 'WETH' ||
    s === 'ETH' ||
    s === 'USDC' ||
    s === 'USDT' ||
    s === 'DAI'
  ) return true

  // pool / derivative / staked tokens
  if (
    n.includes('STAKED') ||
    n.includes('WRAPPED') ||
    n.includes('LP') ||
    n.includes('POOL') ||
    n.includes('AMM') ||
    n.includes('VAULT') ||
    n.includes('DEPOSIT') ||
    n.includes('VOLATILE') ||
    n.includes('V2') ||
    s.includes('LP')
  ) return true

  return false
}


async function fetchJson(url: string, signal: AbortSignal) {
  const r = await fetch(url, {
    signal,
    headers: {
      accept: 'application/json',
      'user-agent': 'ink-dashboard',
    },
    cache: 'no-store',
  })

  const txt = await r.text()
  if (!r.ok) throw new Error(`dexscreener ${r.status}: ${txt.slice(0, 200)}`)

  return JSON.parse(txt)
}

async function fetchHolders(address: string, signal: AbortSignal) {
  try {
    const r = await fetch(`https://explorer.inkonchain.com/api/v2/tokens/${address}`, {
      signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })

    const txt = await r.text()
    if (!r.ok) return null

    let j: any
    try {
      j = JSON.parse(txt)
    } catch {
      return null
    }

    const n = Number(j?.holders_count)
    if (!Number.isFinite(n) || n <= 0) return null
    return n
  } catch {
    return null
  }
}

type ExplorerToken = {
  address_hash?: string
  address?: string
  name?: string
  symbol?: string
  holders_count?: string | number | null
  exchange_rate?: string | number | null
  circulating_market_cap?: string | number | null
  icon_url?: string | null
  type?: string
}

type InkyPumpToken = {
  address?: string
  name?: string
  ticker?: string
  image_url?: string | null
  market_cap?: number | null
  total_holders?: number | null
  status?: string
}

async function fetchInkyPumpTokens(signal: AbortSignal, pages = 10): Promise<InkyPumpToken[]> {
  try {
    const out: InkyPumpToken[] = []

    for (let page = 1; page <= pages; page++) {
      const qs = new URLSearchParams({
        page: String(page),
        sortBy: 'mcap-high',
        status: 'live,funding',
        timeframe: '24h',
      }).toString()

      const url = `${INKYPUMP_TOKENS_API}?${qs}`

      const r = await fetch(url, {
        signal,
        headers: { accept: 'application/json', 'user-agent': 'ink-dashboard' },
        cache: 'no-store',
      })

      const txt = await r.text()
      if (!r.ok) break

      let j: any
      try {
        j = JSON.parse(txt)
      } catch {
        break
      }

      const items = Array.isArray(j?.tokens) ? j.tokens : []
      if (!items.length) break

      out.push(...items)

      const totalPages = Number(j?.totalPages || 0)
      if (Number.isFinite(totalPages) && totalPages > 0 && page >= totalPages) break
    }

    return out
  } catch {
    return []
  }
}


async function fetchExplorerTokens(signal: AbortSignal, limit = 300): Promise<ExplorerToken[]> {
  try {
    const baseParams: Record<string, string> = {
      type: 'ERC-20',
      sort: 'fiat_value',
      order: 'desc',
      items_count: '50',
    }

    const out: ExplorerToken[] = []
    let nextParams: Record<string, any> | null = null

    // pull pages until we hit limit or no next page
    while (out.length < limit) {
      const qs = new URLSearchParams({
        ...baseParams,
        ...(nextParams ? Object.fromEntries(Object.entries(nextParams).map(([k, v]) => [k, String(v)])) : {}),
      }).toString()

      const url = `${EXPLORER_TOKENS_API}?${qs}`

      const r = await fetch(url, {
        signal,
headers: {
  accept: 'application/json',
  'user-agent': 'ink-dashboard',
},
        cache: 'no-store',
      })

      const txt = await r.text()
      if (!r.ok) break

      let j: any
      try {
        j = JSON.parse(txt)
      } catch {
        break
      }

      const items = Array.isArray(j?.items) ? j.items : []
      if (!items.length) break

      out.push(...items)

      // keyset pagination
      nextParams = j?.next_page_params && typeof j.next_page_params === 'object' ? j.next_page_params : null
      if (!nextParams) break
    }

    return out.slice(0, limit)
  } catch {
    return []
  }
}



const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchDexPairsBatch(addresses: string[], signal: AbortSignal): Promise<DexPair[]> {
  const out: DexPair[] = []
  const groups = chunk(addresses, 30)

  for (const g of groups) {
    const url = `${DEX_TOKENS_V1}${CHAIN_ID}/${g.join(',')}`

    const r = await fetch(url, {
      signal,
      headers: { accept: 'application/json', 'user-agent': 'ink-dashboard' },
      cache: 'no-store',
    })

    const txt = await r.text()
    if (!r.ok) continue

    let j: any
    try {
      j = JSON.parse(txt)
    } catch {
      continue
    }

    if (Array.isArray(j)) out.push(...j)
  }

  return out
}


export async function GET() {
  const ac = new AbortController()
const timer = setTimeout(() => ac.abort(), 30000)

  try {
const baseQueries = [
  'ink',
  'ink token',
  'ink meme',
  'ink swap',
  'ink pool',

  'ink velodrome',
  'ink inkyswap',
  'ink dyorswap',
  'ink squidswap',
  'ink nado',

  'ink weth',
  'ink usdc',
  'ink usdt',

  'ink/eth',
  'ink/usdc',
  'ink/usdt',
]

// expand coverage without spamming too hard
const alpha = 'abcdefghijklmnopqrstuvwxyz'.split('')
const extra = [
  ...alpha.map(c => `ink ${c}`),
  ...alpha.map(c => `ink${c}`),
  'ink ai',
  'ink inu',
  'ink pepe',
  'ink dog',
  'ink cat',
]

const queries = Array.from(new Set([...baseQueries, ...extra])).slice(0, 60)



// 0) base list from explorer first (always)
const explorerItems = await fetchExplorerTokens(ac.signal, 600)
const pumpItems = await fetchInkyPumpTokens(ac.signal, 8)

const baseFromExplorer: TokenRow[] = explorerItems
  .map(it => {
    const address = String(it?.address_hash || it?.address || '').toLowerCase()
    const symbol = String(it?.symbol || '')
    if (!address || !symbol) return null
if (isBadToken(symbol, it?.name)) return null

    return {
      address,
      name: String(it?.name || symbol),
      symbol,
      price: toNum(it?.exchange_rate),
      mcap: toNum(it?.circulating_market_cap),
      holders: (() => {
        const n = Number(it?.holders_count)
        return Number.isFinite(n) ? n : null
      })(),
      liquidity: 0,
      volume24h: 0,
      logo: it?.icon_url || undefined,
      pairUrl: undefined,
      pairAddress: undefined,
    } as TokenRow
  })
  .filter(Boolean) as TokenRow[]

  const baseFromPump: TokenRow[] = pumpItems
  .map(it => {
    const address = String(it?.address || '').toLowerCase()
    const symbol = String(it?.ticker || '')
    const name = String(it?.name || symbol)
    if (!address || !symbol) return null
    if (isBadToken(symbol, name)) return null

    return {
      address,
      name,
      symbol,
      price: 0,
mcap: toNum(it?.market_cap),
      holders: typeof it?.total_holders === 'number' ? it.total_holders : null,
      liquidity: 0,
      volume24h: 0,
      logo: it?.image_url || undefined,
      pairUrl: undefined,
      pairAddress: undefined,
    } as TokenRow
  })
  .filter(Boolean) as TokenRow[]


// 1) enrich only top 80 with Dexscreener token endpoint
// 1) build seed list from explorer + inkypump, then Dex batch enrich
const seedMap = new Map<string, TokenRow>()
for (const t of [...baseFromExplorer, ...baseFromPump]) {
  if (!seedMap.has(t.address)) seedMap.set(t.address, t)
}

const seed = Array.from(seedMap.values())

const addrsForDex = seed.slice(0, 600).map(t => t.address)
const dexPairs = await fetchDexPairsBatch(addrsForDex, ac.signal)

const bestByToken = new Map<string, DexPair>()
for (const p of dexPairs) {
  const addr = (p?.baseToken?.address || '').toLowerCase()
  const sym = p?.baseToken?.symbol || ''
  if (!addr) continue
  if (isBadToken(sym, p?.baseToken?.name)) continue

  const prev = bestByToken.get(addr)
  if (!prev || scorePair(p) > scorePair(prev)) bestByToken.set(addr, p)
}


const mergedBase: TokenRow[] = seed.map(t => {
  const p = bestByToken.get(t.address)
  if (!p) return t
  return {
    ...t,
    name: p?.baseToken?.name || t.name,
    symbol: p?.baseToken?.symbol || t.symbol,
    price: toNum(p?.priceUsd) || t.price,
mcap: Math.max(pickMcap(p), t.mcap),
    liquidity: toNum(p?.liquidity?.usd),
    volume24h: toNum(p?.volume?.h24),
    logo: p?.info?.imageUrl || t.logo,
    pairUrl: p?.url || t.pairUrl,
    pairAddress: p?.pairAddress || t.pairAddress,
  }
})




const baseTokens: TokenRow[] = [...mergedBase].sort(
  (a, b) => (b.mcap - a.mcap) || (b.liquidity - a.liquidity) || (b.volume24h - a.volume24h)
)


    // 2️⃣ fetch holders (limit to avoid hammering explorer)
const holderLimited = baseTokens.slice(0, 100)

const holdersResults = await Promise.all(
  holderLimited.map(t => fetchHolders(t.address, ac.signal))
)

const holderMap = new Map<string, number | null>()
holderLimited.forEach((t, i) => holderMap.set(t.address, holdersResults[i]))

const merged: TokenRow[] = baseTokens.map(t => ({
  ...t,
  holders: holderMap.get(t.address) ?? null,
}))

// add explorer tokens that Dexscreener did not return pairs for
const seen = new Set(merged.map(t => t.address.toLowerCase()))

const explorerFallback: TokenRow[] = explorerItems
  .map(it => {
    const address = String(it?.address_hash || it?.address || '').toLowerCase()
    const sym = String(it?.symbol || '')
    if (!address || !sym) return null
    if (seen.has(address)) return null
    if (isBadToken(sym)) return null

    return {
      address,
      name: String(it?.name || sym),
      symbol: sym,
      price: toNum(it?.exchange_rate),
      mcap: toNum(it?.circulating_market_cap),
      holders: (() => {
        const n = Number(it?.holders_count)
        return Number.isFinite(n) ? n : null
      })(),
      liquidity: 0,
      volume24h: 0,
      logo: it?.icon_url || undefined,
      pairUrl: undefined,
      pairAddress: undefined,
    } as TokenRow
  })
  .filter(Boolean) as TokenRow[]

const finalTokens = [...merged, ...explorerFallback]
  .filter(t => t.mcap > 0) // now includes Dex mcap, not only explorer mcap
  .sort((a, b) => (b.mcap - a.mcap) || (b.liquidity - a.liquidity) || (b.volume24h - a.volume24h))



    return NextResponse.json(
  {
    ok: true,
updatedAt: Date.now() + 123,
source: 'dexscreener',
chainId: CHAIN_ID,
debug: {
  explorerItems: explorerItems.length,
  merged: merged.length,
  explorerFallback: explorerFallback.length,
  finalTokens: finalTokens.length,
},
tokens: finalTokens,

  },
  {
    headers: {
  'cache-control': 'no-store, max-age=0',
},

  }
)

  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        updatedAt: Date.now(),
        source: 'dexscreener',
        chainId: CHAIN_ID,
        tokens: [],
        error: e?.message || 'tokens-overview error',
      },
      { status: 200 }
    )
  } finally {
    clearTimeout(timer)
  }
}
