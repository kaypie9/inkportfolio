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
const TOKEN_API = 'https://api.dexscreener.com/latest/dex/tokens/'
const CHAIN_ID = 'ink'

const EXPLORER_TOKENS_API = 'https://explorer.inkonchain.com/api/v2/tokens'


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

const isBadToken = (sym: string) => {
  const s = (sym || '').toUpperCase()
if (s.includes('TELEGRAM') || s.includes('TRON') || s.includes('VIP') || s.includes('HTTP') || s.includes('HTTPS')) return true
return s === 'WETH' || s === 'ETH' || s === 'USDC' || s === 'USDT' || s === 'DAI'
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

async function fetchExplorerTokens(signal: AbortSignal, limit = 200): Promise<ExplorerToken[]> {
  try {
    const url = `${EXPLORER_TOKENS_API}?type=ERC-20&sort=fiat_value&order=desc&items_count=${limit}`
    const r = await fetch(url, {
      signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })

    const txt = await r.text()
    if (!r.ok) return []

    let j: any
    try {
      j = JSON.parse(txt)
    } catch {
      return []
    }

    const items = Array.isArray(j?.items) ? j.items : []
    return items
  } catch {
    return []
  }
}


async function fetchDexTokenPairs(address: string, signal: AbortSignal): Promise<DexPair[]> {
  try {
    const r = await fetch(TOKEN_API + address, {
      signal,
      headers: {
        accept: 'application/json',
        'user-agent': 'ink-dashboard',
      },
      cache: 'no-store',
    })

    const txt = await r.text()
    if (!r.ok) return []

    let j: any
    try {
      j = JSON.parse(txt)
    } catch {
      return []
    }

    return Array.isArray(j?.pairs) ? j.pairs : []
  } catch {
    return []
  }
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
const explorerItems = await fetchExplorerTokens(ac.signal, 200)

const baseFromExplorer: TokenRow[] = explorerItems
  .map(it => {
    const address = String(it?.address_hash || it?.address || '').toLowerCase()
    const symbol = String(it?.symbol || '')
    if (!address || !symbol) return null
    if (isBadToken(symbol)) return null

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

// 1) enrich only top 80 with Dexscreener token endpoint
const topAddrs = baseFromExplorer.slice(0, 80).map(t => t.address)
const enrich = await Promise.allSettled(topAddrs.map(a => fetchDexTokenPairs(a, ac.signal)))

const bestByToken = new Map<string, DexPair>()
for (const res of enrich) {
  if (res.status !== 'fulfilled') continue
  const inkOnly = (res.value || []).filter(p => (p?.chainId || '').toLowerCase() === CHAIN_ID)

  for (const p of inkOnly) {
    const addr = (p?.baseToken?.address || '').toLowerCase()
    const sym = p?.baseToken?.symbol || ''
    if (!addr) continue
    if (isBadToken(sym)) continue

    const prev = bestByToken.get(addr)
    if (!prev || scorePair(p) > scorePair(prev)) bestByToken.set(addr, p)
  }
}

const mergedBase: TokenRow[] = baseFromExplorer.map(t => {
  const p = bestByToken.get(t.address)
  if (!p) return t
  return {
    ...t,
    name: p?.baseToken?.name || t.name,
    symbol: p?.baseToken?.symbol || t.symbol,
    price: toNum(p?.priceUsd) || t.price,
    mcap: pickMcap(p) || t.mcap,
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
