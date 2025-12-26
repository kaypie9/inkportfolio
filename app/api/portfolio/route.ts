// app/api/portfolio/route.ts

import { NextResponse } from 'next/server'
import { getDexScreenerRaw } from '@/lib/aggregators/dexscreener'

function getOrigin(req: Request) {
  try {
    return new URL(req.url).origin
  } catch {
    return ''
  }
}

const RPC_URL = process.env.NEXT_PUBLIC_INK_RPC || 'https://rpc-gel.inkonchain.com'
const BLOCKSCOUT_BASE = 'https://explorer.inkonchain.com/api/v2'

type TokenHolding = {
  address: string
  symbol: string
  name?: string
  decimals: number
  rawBalance: string
  balance: number
  priceUsd?: number
  valueUsd?: number
  iconUrl?: string
}

type TokenMarketData = { priceUsd: number; logoUrl?: string }

const BIGINT_ZERO = BigInt(0)

async function ethCallRaw(to: string, data: string): Promise<string> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to, data }, 'latest'],
      }),
    })

    const json = await res.json()
    return String(json.result || '0x0')
  } catch {
    return '0x0'
  }
}

function hexToBigInt(hex: string): bigint {
  if (!hex || typeof hex !== 'string') return BIGINT_ZERO
  try {
    return BigInt(hex)
  } catch {
    return BIGINT_ZERO
  }
}

async function getNativeBalance(address: string): Promise<number> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    })

    const json = await res.json()
    const wei = hexToBigInt(String(json.result || '0x0'))
    return Number(wei) / 1e18
  } catch {
    return 0
  }
}

async function getTokenMarketData(address: string): Promise<TokenMarketData> {
  try {
    if (!address) return { priceUsd: 0 }

    let data: any
    try {
      data = await getDexScreenerRaw(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`,
        { ttlMs: 15_000 }
      )
    } catch {
      return { priceUsd: 0 }
    }

    const pair = Array.isArray(data?.pairs) ? data.pairs[0] : undefined
    if (!pair) return { priceUsd: 0 }

    const price = Number(pair.priceUsd || 0)
    const info = pair.info || {}
    const logoUrl =
      typeof info.imageUrl === 'string' && info.imageUrl.length > 0 ? info.imageUrl : undefined

    return { priceUsd: Number.isFinite(price) ? price : 0, logoUrl }
  } catch {
    return { priceUsd: 0 }
  }
}

async function fetchErc20Tokens(address: string): Promise<TokenHolding[]> {
  try {
    const res = await fetch(`${BLOCKSCOUT_BASE}/addresses/${address}/tokens?type=ERC-20`, {
      next: { revalidate: 30 },
    })

    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data.items)) return []

    return data.items.map((item: any) => {
      const token = item.token || {}
      const raw = String(item.value ?? '0')
      const decimals = Number(token.decimals ?? 18)

      let balance = 0
      try {
        const units = BigInt(raw)
        balance = Number(units) / 10 ** decimals
      } catch {
        balance = 0
      }

      const rawAddr =
        token.address ||
        token.address_hash ||
        token.contractAddress ||
        item.token_address ||
        item.address ||
        item.contract_address ||
        ''

      const addr = String(rawAddr).toLowerCase()
      const symbol = String(token.symbol || '')
      const tokenName = String(token.name || '')
      const iconUrl = typeof token.icon_url === 'string' ? token.icon_url : ''

      return {
        address: addr,
        symbol,
        name: tokenName,
        decimals,
        rawBalance: raw,
        balance,
        iconUrl,
      }
    })
  } catch {
    return []
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const wallet = url.searchParams.get('wallet')

    if (!wallet) {
      return NextResponse.json({ ok: false, error: 'wallet param is required' }, { status: 400 })
    }

    const [nativeInk, tokens] = await Promise.all([getNativeBalance(wallet), fetchErc20Tokens(wallet)])

    const stableSymbols = new Set(['USDC', 'USDT', 'DAI', 'GHO', 'FRAX', 'SUSD'])

    const addrList = Array.from(new Set(tokens.map((t) => t.address).filter((a) => a && a !== 'native')))
      .slice(0, 25)

    const marketResults = await Promise.all(addrList.map((addr) => getTokenMarketData(addr)))

    const priceMap: Record<string, number> = {}
    const logoMap: Record<string, string> = {}

    addrList.forEach((addr, i) => {
      const m = marketResults[i]
      if (!m) return
      priceMap[addr] = m.priceUsd || 0
      if (m.logoUrl) logoMap[addr] = m.logoUrl
    })

let pricedTokens: TokenHolding[] = tokens.map((t) => {
  const upper = (t.symbol || '').toUpperCase()
  let price = priceMap[t.address] || 0
  if (stableSymbols.has(upper) && price === 0) price = 1

  const value = price > 0 ? t.balance * price : 0
  const iconUrl = t.iconUrl && t.iconUrl.length > 0 ? t.iconUrl : logoMap[t.address] || undefined

  return { ...t, priceUsd: price, valueUsd: value, iconUrl }
})

// hide LPs by asking /api/positions (only ones that actually decompose as LP)
try {
  const origin = getOrigin(req)
  if (origin) {
    const r = await fetch(
      `${origin}/api/positions?wallet=${encodeURIComponent(wallet)}`,
      { cache: 'no-store' }
    )

    if (r.ok) {
      const j: any = await r.json()
      const list: any[] = Array.isArray(j?.positions) ? j.positions : []
      const lpAddrs = new Set<string>()

      for (const p of list) {
        const a = String(p?.tokenAddress || '').toLowerCase()
        if (!a || a === 'native-ink') continue
        if (p?.lpBreakdown) lpAddrs.add(a)
      }

      if (lpAddrs.size) {
        pricedTokens = pricedTokens.filter((t) => {
          const a = String(t?.address || '').toLowerCase()
          if (!a || a === 'native-ink') return true
          return !lpAddrs.has(a)
        })
      }
    }
  }
} catch {}


    const stablesUsd = pricedTokens
      .filter((t) => stableSymbols.has((t.symbol || '').toUpperCase()))
      .reduce((sum, t) => sum + (t.valueUsd || 0), 0)

    const tokensUsd = pricedTokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0)

    const totalValueUsd = tokensUsd

    const portfolio = {
      mock: false,
      address: wallet,
      totalValueUsd,
      balances: {
        nativeInk,
        stables: stablesUsd,
        lpTokens: 0,
      },
      vaults: [],
      vaultDepositsUsd: 0,
      unclaimedYieldUsd: 0,
      tokens: pricedTokens,
    }

    return NextResponse.json(portfolio)
  } catch (err) {
    console.error('api/portfolio fatal error', err)
    return NextResponse.json({ ok: false, error: 'internal portfolio error' }, { status: 500 })
  }
}
