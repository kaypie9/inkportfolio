// app/api/portfolio/route.ts

import { NextResponse } from 'next/server'
import { getDexScreenerRaw } from '@/lib/aggregators/dexscreener'
import { fetchNadoUsdEquity } from '@/lib/nado'

function getOrigin(req: Request) {
  try {
    return new URL(req.url).origin
  } catch {
    return ''
  }
}

const RPC_URL = process.env.NEXT_PUBLIC_INK_RPC || 'https://rpc-gel.inkonchain.com'
const BLOCKSCOUT_BASE = 'https://explorer.inkonchain.com/api/v2'

const NADO_MARGIN_CONTRACT =
  '0x05ec92d78ed421f3d3ada77ffde167106565974e'.toLowerCase()

const BIGINT_ZERO = BigInt(0)

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
  lpBreakdown?: {
    token0Symbol: string
    token1Symbol: string
    amount0: number
    amount1: number
    token0Address: string
    token1Address: string
    token0IconUrl?: string
    token1IconUrl?: string
  }
}

export type VaultPosition = {
  tokenAddress: string
  symbol: string
  protocol: string
  poolName: string
  amount: number
  depositedUsd: number
  rewardsUsd?: number
  apr?: number
  lpBreakdown?: TokenHolding['lpBreakdown']
  factoryAddress?: string | null
  creatorAddress: string | null
  iconUrl?: string
}

type TokenMarketData = { priceUsd: number; logoUrl?: string }

async function getEthUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { cache: 'no-store' }
    )
    if (!res.ok) return 0
    const j: any = await res.json()
    const p = Number(j?.ethereum?.usd || 0)
    return Number.isFinite(p) ? p : 0
  } catch {
    return 0
  }
}

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

async function readTotalSupply(tokenAddr: string): Promise<bigint> {
  const data = '0x18160ddd'
  const hex = await ethCallRaw(tokenAddr, data)
  return hexToBigInt(hex)
}

async function readToken0(pairAddr: string): Promise<string> {
  const data = '0x0dfe1681'
  const hex = await ethCallRaw(pairAddr, data)
  const body = hex.replace(/^0x/, '')
  if (body.length < 64) return ''
  const field = body.slice(0, 64)
  return ('0x' + field.slice(24)).toLowerCase()
}

async function readToken1(pairAddr: string): Promise<string> {
  const data = '0xd21220a7'
  const hex = await ethCallRaw(pairAddr, data)
  const body = hex.replace(/^0x/, '')
  if (body.length < 64) return ''
  const field = body.slice(0, 64)
  return ('0x' + field.slice(24)).toLowerCase()
}

async function readDecimals(tokenAddr: string): Promise<number> {
  const data = '0x313ce567'
  const hex = await ethCallRaw(tokenAddr, data)
  const body = hex.replace(/^0x/, '')
  if (body.length < 64) return 18
  const field = '0x' + body.slice(0, 64)

  try {
    const n = Number(BigInt(field))
    if (!Number.isFinite(n) || n <= 0 || n > 36) return 18
    return n
  } catch {
    return 18
  }
}

async function readReserves(pairAddr: string): Promise<{ reserve0: bigint; reserve1: bigint }> {
  const data = '0x0902f1ac'
  const hex = await ethCallRaw(pairAddr, data)
  const body = hex.replace(/^0x/, '')
  if (body.length < 64 * 2) return { reserve0: BIGINT_ZERO, reserve1: BIGINT_ZERO }

  const r0Hex = '0x' + body.slice(0, 64)
  const r1Hex = '0x' + body.slice(64, 128)

  return { reserve0: hexToBigInt(r0Hex), reserve1: hexToBigInt(r1Hex) }
}

async function readFactoryOwner(factoryAddr: string): Promise<string | null> {
  try {
    const data = '0x8da5cb5b'
    const hex = await ethCallRaw(factoryAddr, data)
    const body = hex.replace(/^0x/, '')
    if (body.length < 64) return null
    return ('0x' + body.slice(24, 64)).toLowerCase()
  } catch {
    return null
  }
}

function decodeAddrFromCallResult(hex: string): string | null {
  const body = String(hex || '').replace(/^0x/, '')
  if (body.length < 64) return null
  const addr = ('0x' + body.slice(24, 64)).toLowerCase()
  if (addr === '0x0000000000000000000000000000000000000000') return null
  if (!addr.startsWith('0x') || addr.length !== 42) return null
  return addr
}

async function readFactory(pairAddr: string): Promise<string | null> {
  try {
    const selectors = [
      '0xc45a0155', // factory()
      '0x88cc58e4', // getFactory()
      '0xd8a06f73', // vaultFactory()
      '0xdd81fa63', // ichiVaultFactory()
      '0x56e6004b', // ICHIVaultFactory()
      '0x4219dc40', // poolFactory()
      '0xe14f870d', // pairFactory()
    ]

    for (const data of selectors) {
      const hex = await ethCallRaw(pairAddr, data)
      const addr = decodeAddrFromCallResult(hex)
      if (addr) return addr
    }

    return null
  } catch {
    return null
  }
}

async function resolveCreatorAddress(pairAddr: string): Promise<string | null> {
  try {
    const factory = await readFactory(pairAddr)
    if (!factory) return null

    const owner = await readFactoryOwner(factory)
    if (owner) return owner

    return factory
  } catch {
    return null
  }
}

async function fetchTokenSymbol(addr: string): Promise<string> {
  try {
    const res = await fetch(`${BLOCKSCOUT_BASE}/tokens/${addr}`)
    if (!res.ok) return ''
    const data = await res.json()
    return data?.symbol || ''
  } catch {
    return ''
  }
}

async function getTokenIconMeta(address: string): Promise<{ iconUrl?: string }> {
  try {
    if (!address) return {}

    try {
      const resExplorer = await fetch(`${BLOCKSCOUT_BASE}/tokens/${address}`)
      if (resExplorer.ok) {
        const data = await resExplorer.json()
        const icon = (data as any)?.icon_url
        if (typeof icon === 'string' && icon.length > 0) return { iconUrl: icon }
      }
    } catch {}

    let data: any
    try {
      data = await getDexScreenerRaw(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`,
        { ttlMs: 15_000 }
      )
    } catch {
      return {}
    }

    const pair = Array.isArray((data as any).pairs) ? (data as any).pairs[0] : undefined
    if (!pair) return {}

    const info = pair.info || {}
    const iconUrl =
      typeof info.imageUrl === 'string' && info.imageUrl.length > 0 ? info.imageUrl : undefined

    return { iconUrl }
  } catch {
    return {}
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

async function applyLpDecompositionAuto(
  tokens: TokenHolding[],
  priceMap: Record<string, number>
): Promise<TokenHolding[]> {
  const out: TokenHolding[] = []

  for (const t of tokens) {
    if (!t.address) {
      out.push(t)
      continue
    }

    const pairAddr = t.address.toLowerCase()

    let userLp: bigint
    try {
      userLp = BigInt(t.rawBalance || '0')
    } catch {
      out.push(t)
      continue
    }

    if (userLp === BigInt(0)) {
      out.push(t)
      continue
    }

    const [token0Addr, token1Addr] = await Promise.all([readToken0(pairAddr), readToken1(pairAddr)])

    if (
      !token0Addr ||
      !token1Addr ||
      token0Addr === '0x0000000000000000000000000000000000000000' ||
      token1Addr === '0x0000000000000000000000000000000000000000'
    ) {
      out.push(t)
      continue
    }

    const [dec0, dec1] = await Promise.all([readDecimals(token0Addr), readDecimals(token1Addr)])

    const [totalSupply, { reserve0, reserve1 }] = await Promise.all([
      readTotalSupply(pairAddr),
      readReserves(pairAddr),
    ])

    if (totalSupply === BIGINT_ZERO) {
      out.push(t)
      continue
    }

    const share = Number(userLp) / Number(totalSupply)
    if (!Number.isFinite(share) || share <= 0) {
      out.push(t)
      continue
    }

    const amount0 = (Number(reserve0) / 10 ** dec0) * share
    const amount1 = (Number(reserve1) / 10 ** dec1) * share

    const addr0 = token0Addr.toLowerCase()
    const addr1 = token1Addr.toLowerCase()

    let price0 = priceMap[addr0] || 0
    let price1 = priceMap[addr1] || 0

    if (!price0) {
      const m0 = await getTokenMarketData(addr0)
      price0 = m0.priceUsd || 0
      if (price0) priceMap[addr0] = price0
    }

    if (!price1) {
      const m1 = await getTokenMarketData(addr1)
      price1 = m1.priceUsd || 0
      if (price1) priceMap[addr1] = price1
    }

    const valueUsd = amount0 * price0 + amount1 * price1
    const rawPoolLabel = (t.name || '').trim() || (t.symbol || '').trim() || 'LP position'

    const [sym0, sym1, iconMeta0, iconMeta1] = await Promise.all([
      fetchTokenSymbol(addr0),
      fetchTokenSymbol(addr1),
      getTokenIconMeta(addr0),
      getTokenIconMeta(addr1),
    ])

    out.push({
      ...t,
      valueUsd,
      name: rawPoolLabel,
      lpBreakdown: {
        token0Symbol: sym0,
        token1Symbol: sym1,
        amount0,
        amount1,
        token0Address: addr0,
        token1Address: addr1,
        token0IconUrl: iconMeta0.iconUrl,
        token1IconUrl: iconMeta1.iconUrl,
      },
    })
  }

  return out
}

function guessVaultFromToken(t: TokenHolding): { protocol: string; pool: string } | null {
  if (t.lpBreakdown) {
    const poolLabel = t.name || t.symbol || 'LP position'
    return { protocol: 'Onchain', pool: poolLabel }
  }
  return null
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const wallet = url.searchParams.get('wallet')

    if (!wallet) {
      return NextResponse.json({ ok: false, error: 'wallet param is required' }, { status: 400 })
    }

    const [nativeInk, nativeUsdPrice, tokens, nadoUsd] = await Promise.all([
      getNativeBalance(wallet),
      getEthUsdPrice(),
      fetchErc20Tokens(wallet),
      fetchNadoUsdEquity(wallet),
    ])

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

    pricedTokens = await applyLpDecompositionAuto(pricedTokens, priceMap)

    const vaults: VaultPosition[] = []

    for (const t of pricedTokens) {
      const hint = guessVaultFromToken(t)
      if (!hint || t.balance <= 0) continue

      const valueUsd = t.valueUsd != null ? t.valueUsd : (t.priceUsd ?? 0) * t.balance
      const factoryAddress = t.lpBreakdown ? await readFactory(t.address) : null

      vaults.push({
        tokenAddress: t.address,
        symbol: t.symbol,
        protocol: hint.protocol,
        poolName: hint.pool,
        amount: t.balance,
        depositedUsd: valueUsd,
        rewardsUsd: 0,
        lpBreakdown: t.lpBreakdown,
        factoryAddress,
        creatorAddress: null,
        iconUrl: t.iconUrl,
      })
    }

    if (nadoUsd && Number.isFinite(nadoUsd) && nadoUsd > 0) {
      vaults.push({
        tokenAddress: 'nado-margin',
        symbol: 'USDT',
        protocol: 'Nado',
        poolName: 'Nado account',
        amount: nadoUsd,
        depositedUsd: nadoUsd,
        rewardsUsd: 0,
        creatorAddress: NADO_MARGIN_CONTRACT,
        iconUrl: undefined,
      })
    }

    const enrichedVaults: VaultPosition[] = await Promise.all(
      vaults.map(async (v) => {
        const existing = (v.creatorAddress || '').toLowerCase()
        if (existing.startsWith('0x') && existing.length === 42) return v

        const rawAddr: string = (v as any).poolAddress || (v as any).contractAddress || v.tokenAddress || ''
        if (!rawAddr) return v

        const addr = rawAddr.toLowerCase()
        if (!addr.startsWith('0x') || addr.length !== 42) return v

        let creator: string | null = null
        try {
          creator = await resolveCreatorAddress(addr)
        } catch {
          creator = null
        }

        return { ...v, factoryAddress: v.factoryAddress || null, creatorAddress: creator || v.creatorAddress || null }
      })
    )

    // remove LP receipt tokens from wallet tokens, they live in positions now
    const lpAddrs = new Set<string>()
    for (const v of enrichedVaults) {
      const a = String(v.tokenAddress || '').toLowerCase()
      if (a && a.startsWith('0x') && a.length === 42) lpAddrs.add(a)
    }

    const walletTokens = pricedTokens.filter((t) => {
      const a = String(t.address || '').toLowerCase()
      if (!a) return true
      return !lpAddrs.has(a)
    })

    const stablesUsd = walletTokens
      .filter((t) => stableSymbols.has((t.symbol || '').toUpperCase()))
      .reduce((sum, t) => sum + (t.valueUsd || 0), 0)

    const tokensUsd = walletTokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0)
    const nativeUsd = nativeUsdPrice > 0 ? nativeInk * nativeUsdPrice : 0

    const walletValueUsd = tokensUsd + nativeUsd
    const positionsUsd = enrichedVaults.reduce((sum, v) => {
      const dep = Number(v.depositedUsd || 0)
      const rew = Number(v.rewardsUsd || 0)
      return sum + (Number.isFinite(dep) ? dep : 0) + (Number.isFinite(rew) ? rew : 0)
    }, 0)

    const totalValueUsd = walletValueUsd + positionsUsd

    const portfolio = {
      mock: false,
      address: wallet,
      nativeUsdPrice,
      walletValueUsd,
      totalValueUsd,
      balances: {
        nativeInk,
        stables: stablesUsd,
        lpTokens: 0,
      },
      vaults: enrichedVaults,
      positions: enrichedVaults,
      vaultDepositsUsd: positionsUsd,
      unclaimedYieldUsd: 0,
      tokens: walletTokens,
    }

    return NextResponse.json(portfolio)
  } catch (err) {
    console.error('api/portfolio fatal error', err)
    return NextResponse.json({ ok: false, error: 'internal portfolio error' }, { status: 500 })
  }
}
