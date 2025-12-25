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
  quoteToken?: { address?: string; name?: string; symbol?: string }
  info?: { imageUrl?: string }
}


type TokenRow = {
  source?: 'pump' | 'explorer' | 'dex'
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
const DEX_LATEST_TOKENS = 'https://api.dexscreener.com/latest/dex/tokens/'

const CHAIN_ID = 'ink'

const EXPLORER_TOKENS_API = 'https://explorer.inkonchain.com/api/v2/tokens'
const INKYPUMP_TOKENS_API = 'https://inkypump.com/api/tokens'
const ETH_PRICE_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'


const toNum = (v: any) => {
  if (v === null || v === undefined) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0

  const s = String(v).trim()
  if (!s) return 0

  // remove currency symbols and commas
  const cleaned = s.replace(/[^0-9.+-eE]/g, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}


const pickMcap = (p: DexPair) => {
  const mc = typeof p.marketCap === 'number' ? p.marketCap : 0
  const fdv = typeof p.fdv === 'number' ? p.fdv : 0
  return mc > 0 ? mc : fdv
}

const normChain = (chainId: string | undefined) => (String(chainId || CHAIN_ID).toLowerCase() || CHAIN_ID)
const keyFor = (chainId: string | undefined, address: string) => `${normChain(chainId)}:${address.toLowerCase()}`

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

  // inkypump extra fields (they may exist)
  liquidity?: number | string | null
  liquidity_usd?: number | string | null
  liquidityUsd?: number | string | null
  volume_24h?: number | string | null
  volume24h?: number | string | null
  volume_usd_24h?: number | string | null
}

async function fetchEthPrice(signal: AbortSignal): Promise<number> {
  try {
    const r = await fetch(ETH_PRICE_API, { signal, cache: 'no-store' })
    const j = await r.json()
    const p = Number(j?.ethereum?.usd)
    return Number.isFinite(p) && p > 0 ? p : 0
  } catch {
    return 0
  }
}


async function fetchInkyPumpTokens(signal: AbortSignal): Promise<InkyPumpToken[]> {
  try {
const qs = new URLSearchParams({
  page: '1',
  sortBy: 'mcap-high',
}).toString()

const url = `${INKYPUMP_TOKENS_API}?${qs}`

const r = await fetch(url, {
  signal,
  headers: { accept: 'application/json', 'user-agent': 'ink-dashboard' },
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

return Array.isArray(j?.tokens) ? j.tokens : []
  } catch {
    return []
  }
}


async function fetchExplorerTokens(
  signal: AbortSignal,
  limit = 50
): Promise<{ items: ExplorerToken[]; status: number; url: string; bodyHead: string }> {
  try {
    // try 1: full params
    const qs1 = new URLSearchParams({
      type: 'ERC-20',
      sort: 'fiat_value',
      order: 'desc',
      items_count: '50',
    }).toString()

    const url1 = `${EXPLORER_TOKENS_API}?${qs1}`

    const r1 = await fetch(url1, {
      signal,
      headers: { accept: 'application/json', 'user-agent': 'ink-dashboard' },
      cache: 'no-store',
    })

    const t1 = await r1.text()
    if (r1.ok) {
      try {
        const j1: any = JSON.parse(t1)
        const items1 = Array.isArray(j1?.items) ? j1.items : []
        if (items1.length) return { items: items1.slice(0, limit), status: 200, url: url1, bodyHead: '' }
      } catch {
        // fall through to retry
      }
    }

    // try 2: minimal params (some explorers reject sort keys sometimes)
    const qs2 = new URLSearchParams({
      type: 'ERC-20',
      items_count: '50',
    }).toString()

    const url2 = `${EXPLORER_TOKENS_API}?${qs2}`

    const r2 = await fetch(url2, {
      signal,
      headers: { accept: 'application/json', 'user-agent': 'ink-dashboard' },
      cache: 'no-store',
    })

    const t2 = await r2.text()
    if (!r2.ok) return { items: [], status: r2.status, url: url2, bodyHead: t2.slice(0, 180) }

    let j2: any
    try {
      j2 = JSON.parse(t2)
    } catch {
      return { items: [], status: 0, url: url2, bodyHead: t2.slice(0, 180) }
    }

    const items2 = Array.isArray(j2?.items) ? j2.items : []
    return { items: items2.slice(0, limit), status: 200, url: url2, bodyHead: '' }
  } catch (e: any) {
    return {
      items: [],
      status: -1,
      url: EXPLORER_TOKENS_API,
      bodyHead: String(e?.message || 'fetch failed').slice(0, 180),
    }
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

async function fetchDexLatestTokenPairs(address: string, signal: AbortSignal): Promise<DexPair[]> {
  try {
    const url = `${DEX_LATEST_TOKENS}${address}`
    const r = await fetch(url, {
      signal,
      headers: { accept: 'application/json', 'user-agent': 'ink-dashboard' },
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
const explorerRes = await fetchExplorerTokens(ac.signal, 50)
const explorerItems = explorerRes.items
const ethPriceUsd = await fetchEthPrice(ac.signal)
const pumpItems = await fetchInkyPumpTokens(ac.signal)

const baseFromExplorer: TokenRow[] = explorerItems
  .map(it => {
    const address = String(it?.address_hash || it?.address || '').toLowerCase()
    const symbol = String(it?.symbol || '')
    if (!address || !symbol) return null
if (isBadToken(symbol, it?.name)) return null

        return {
      source: 'explorer',
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

const rawLiq = toNum(
  (it as any)?.liquidity ??
  (it as any)?.liquidity_eth ??
  (it as any)?.liquidity_usd ??
  (it as any)?.liquidityUsd
)

const rawVol = toNum(
  (it as any)?.volume24h ??
  (it as any)?.volume_24h ??
  (it as any)?.volume_eth_24h ??
  (it as any)?.volume_usd_24h
)

const pumpMcap = toNum((it as any)?.market_cap)
const pumpPriceEth = toNum((it as any)?.price ?? (it as any)?.price_eth ?? 0)

// if inkypump already gave usd, do not multiply again
const pumpLiqIsUsd = (it as any)?.liquidity_usd != null || (it as any)?.liquidityUsd != null
const pumpVolIsUsd = (it as any)?.volume_usd_24h != null

return {
  source: 'pump',
  address,
  name,
  symbol,

  // price: inkypump is ETH, convert to USD
  price: ethPriceUsd > 0 && pumpPriceEth > 0 ? pumpPriceEth * ethPriceUsd : 0,

  // mcap: inkypump is ETH, convert to USD
  mcap: ethPriceUsd > 0 ? pumpMcap * ethPriceUsd : pumpMcap,

  // liquidity and volume: prefer usd fields if they exist
  liquidity: pumpLiqIsUsd ? rawLiq : (ethPriceUsd > 0 ? rawLiq * ethPriceUsd : rawLiq),
  volume24h: pumpVolIsUsd ? rawVol : (ethPriceUsd > 0 ? rawVol * ethPriceUsd : rawVol),

  holders: typeof it?.total_holders === 'number' ? it.total_holders : null,
  logo: it?.image_url || undefined,
  pairUrl: undefined,
  pairAddress: undefined,
} as TokenRow

  })
  .filter(Boolean) as TokenRow[]


// 1) enrich only top 80 with Dexscreener token endpoint
// 1) build seed list from explorer + inkypump, then Dex batch enrich
const seedMap = new Map<string, TokenRow>()

// pump first so they never get pushed out
for (const t of baseFromPump) {
  if (!seedMap.has(t.address)) seedMap.set(t.address, t)
}
for (const t of baseFromExplorer) {
  if (!seedMap.has(t.address)) seedMap.set(t.address, t)
}

const seed = Array.from(seedMap.values())


const pumpAddrs = baseFromPump.map(t => t.address)
const otherAddrs = seed
  .filter(t => !pumpAddrs.includes(t.address))
  .map(t => t.address)

// Dex only for tokens that need enrichment (missing liq/vol/pair)
const needDex = seed.filter(t => {
  const hasPair = !!t.pairUrl || !!t.pairAddress
  const hasLiq = t.liquidity > 0
  const hasVol = t.volume24h > 0
  return !hasPair || !hasLiq || !hasVol
})

// Dex only for explorer tokens (pump stays authoritative)
const explorerNeedDex = seed.filter(t => {
  if (t.source !== 'explorer') return false
  const hasPair = !!t.pairUrl || !!t.pairAddress
  const hasLiq = t.liquidity > 0
  const hasVol = t.volume24h > 0
  const hasPrice = t.price > 0
  return !hasPair || !hasLiq || !hasVol || !hasPrice
})

// cap so we do not spam Dex
const addrsForDex = needDex.map(t => t.address).slice(0, 240)
const dexPairs = addrsForDex.length ? await fetchDexPairsBatch(addrsForDex, ac.signal) : []
const addrsSet = new Set(addrsForDex.map(a => a.toLowerCase()))

// fallback: batch endpoint misses some Ink pairs, so use latest per-token for a small capped set
const needLatest = seed
  .filter(t => t.source === 'explorer') // never touch pump
  .filter(t => addrsSet.has(t.address.toLowerCase()))
  .filter(t => t.liquidity <= 0) // still missing from explorer data
  .map(t => t.address)
  .slice(0, 40) // hard cap

const latestPairs: DexPair[] = []
for (const addr of needLatest) {
  const pairs = await fetchDexLatestTokenPairs(addr, ac.signal)
  for (const p of pairs) {
    if (normChain(p?.chainId) === CHAIN_ID) latestPairs.push(p)
  }
}

const allDexPairs = [...dexPairs, ...latestPairs]





const bestPriceByToken = new Map<string, DexPair>()
const bestLiqByToken = new Map<string, DexPair>()

for (const p of allDexPairs) {
  const pChain = normChain(p?.chainId)
  if (pChain !== CHAIN_ID) continue

  const baseAddr = (p?.baseToken?.address || '').toLowerCase()
  const quoteAddr = (p?.quoteToken?.address || '').toLowerCase()
  if (!baseAddr && !quoteAddr) continue

  // A) price map: only when OUR token is base token
  if (baseAddr && addrsSet.has(baseAddr)) {
    const sym = p?.baseToken?.symbol || ''
    const name = p?.baseToken?.name || ''
    if (!isBadToken(sym, name)) {
      const k = keyFor(pChain, baseAddr)
      const prev = bestPriceByToken.get(k)
      if (!prev || scorePair(p) > scorePair(prev)) bestPriceByToken.set(k, p)
    }
  }

  // B) liquidity map: OUR token can be base OR quote
  const matchedAddr = addrsSet.has(baseAddr) ? baseAddr : (addrsSet.has(quoteAddr) ? quoteAddr : '')
  if (!matchedAddr) continue

  const matchedSym = matchedAddr === baseAddr ? (p?.baseToken?.symbol || '') : (p?.quoteToken?.symbol || '')
  const matchedName = matchedAddr === baseAddr ? (p?.baseToken?.name || '') : (p?.quoteToken?.name || '')
  if (isBadToken(matchedSym, matchedName)) continue

  const k2 = keyFor(pChain, matchedAddr)
  const prev2 = bestLiqByToken.get(k2)

  // for liquidity map, prefer pairs that actually have liquidity first
  const hasLiq = toNum(p?.liquidity?.usd) > 0
  const prevHasLiq = toNum(prev2?.liquidity?.usd) > 0

  if (!prev2) {
    bestLiqByToken.set(k2, p)
  } else if (hasLiq && !prevHasLiq) {
    bestLiqByToken.set(k2, p)
  } else if (scorePair(p) > scorePair(prev2)) {
    bestLiqByToken.set(k2, p)
  }
}


const dexWithLiq = allDexPairs.filter(p => normChain(p?.chainId) === CHAIN_ID && toNum(p?.liquidity?.usd) > 0).length




const mergedBase: TokenRow[] = seed.map(t => {
  // pump stays untouched
  if (t.source === 'pump') return t

const pPrice = bestPriceByToken.get(keyFor(CHAIN_ID, t.address))
const pLiq = bestLiqByToken.get(keyFor(CHAIN_ID, t.address))
if (!pPrice && !pLiq) return t

const dexPrice = toNum(pPrice?.priceUsd)
const dexMcap = pPrice ? pickMcap(pPrice) : 0

const dexLiq = toNum(pLiq?.liquidity?.usd)
const dexVol = toNum(pLiq?.volume?.h24)


  return {
    ...t,

    // only fill if missing
    price: t.price > 0 ? t.price : dexPrice,
    liquidity: Math.max(t.liquidity, dexLiq),
    volume24h: Math.max(t.volume24h, dexVol),
    mcap: Math.max(t.mcap, dexMcap),

    // only fill links if missing
pairUrl: t.pairUrl ? t.pairUrl : ((pLiq?.url || pPrice?.url) || undefined),
pairAddress: t.pairAddress ? t.pairAddress : ((pLiq?.pairAddress || pPrice?.pairAddress) || undefined),
logo: t.logo ? t.logo : ((pPrice?.info?.imageUrl || pLiq?.info?.imageUrl) || undefined),

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
  .filter(t => t.source === 'pump' ? true : t.mcap > 0)
  .sort((a, b) => (b.mcap - a.mcap) || (b.liquidity - a.liquidity) || (b.volume24h - a.volume24h))



    return NextResponse.json(
  {
    ok: true,
updatedAt: Date.now() + 123,
source: 'inkypump+explorer',
chainId: CHAIN_ID,
debug: {
  pumpItems: pumpItems.length,
  baseFromPump: baseFromPump.length,
  explorerItems: explorerItems.length,
  explorerStatus: explorerRes.status,
  explorerUrl: explorerRes.url,
  explorerBodyHead: explorerRes.bodyHead,
  merged: merged.length,
  explorerFallback: explorerFallback.length,
finalTokens: finalTokens.length,
dexPairs: allDexPairs.length,
dexLatestPairs: latestPairs.length,
dexWithLiq,
dexTargets: addrsForDex.length,
explorerNeedDex: explorerNeedDex.length,
seed: seed.length,

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
source: 'inkypump+explorer',
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
