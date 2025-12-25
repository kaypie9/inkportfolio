import { NextResponse } from 'next/server'
import { TOKEN_META } from '@/app/data/tokenMeta'
import { rateLimit } from '@/lib/rateLimit'
import { getInkyPumpRaw } from '@/lib/aggregators/inkypump'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

let cachedEthUsd: { v: number; ts: number } | null = null
let cachedRows: { rows: any[]; ts: number } | null = null

async function fetchJsonWithTimeout(url: string, ms: number) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)

  try {
    const r = await fetch(url, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0',
      },
      signal: ctrl.signal,
    })

    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function getEthUsd() {
  const now = Date.now()

  if (cachedEthUsd && now - cachedEthUsd.ts < 5 * 60 * 1000) {
    return cachedEthUsd.v
  }

  const j = await fetchJsonWithTimeout(
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    1500
  )

  const v = toNum(j?.ethereum?.usd)
  if (v && v > 0) {
    cachedEthUsd = { v, ts: now }
    return v
  }

  return cachedEthUsd?.v ?? null
}

export async function GET(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local'

  if (!rateLimit(`${ip}:explore_top_mcap`, 30, 60_000)) {
    return NextResponse.json({ ok: false, rows: [], error: 'rate limited' }, { status: 429 })
  }

  try {
    const ethUsd = await getEthUsd()


    let j: any
try {
  j = await getInkyPumpRaw(
    'https://inkypump.com/api/tokens?page=1&sortBy=mcap-high',
    { ttlMs: 15_000 }
  )
} catch {
  j = null
}


if (!j) {
  // if inkypump is slow/down, serve last good data for 60s
  if (cachedRows && Date.now() - cachedRows.ts < 60_000) {
    return NextResponse.json({ ok: true, rows: cachedRows.rows, cached: true }, { status: 200 })
  }
  return NextResponse.json({ ok: false, rows: [], error: 'inkypump timeout' }, { status: 200 })
}

const items = Array.isArray(j?.tokens) ? j.tokens : []


    const rows = items
      .map((t: any) => {
        const address = String(t?.address ?? '').toLowerCase()

        const symbol =
          typeof t?.ticker === 'string'
            ? t.ticker
            : typeof t?.symbol === 'string'
            ? t.symbol
            : undefined

        const name = typeof t?.name === 'string' ? t.name : undefined

        const priceEth = toNum(t?.price_eth) ?? null
        const mcapEth = toNum(t?.market_cap) ?? null
        const volEth = toNum(t?.volume_24h) ?? null
        const liqEth = toNum(t?.liquidity) ?? null

        const price = ethUsd && priceEth !== null ? priceEth * ethUsd : null
        const mcap = ethUsd && mcapEth !== null ? mcapEth * ethUsd : null
        const volume24h = ethUsd && volEth !== null ? volEth * ethUsd : null
        const liquidity = ethUsd && liqEth !== null ? liqEth * ethUsd : null

        const meta = TOKEN_META[address] ?? null

return {
  address,
  symbol,
  name,
  price,
  mcap,
  volume24h,
  liquidity,
  icon: typeof t?.image_url === 'string' ? t.image_url : null,

  // local metadata
  description: meta?.description ?? null,
  website: meta?.website ?? null,
  twitter: meta?.twitter ?? null,
  telegram: meta?.telegram ?? null,
  discord: meta?.discord ?? null,
}

      })
      .filter((x: any) => x.address && x.mcap !== null && x.mcap > 0)
      .slice(0, 3)

      const rowsWithMeta = rows.map((x: any) => {
  const meta = TOKEN_META[String(x.address || '').toLowerCase()]
  return meta ? { ...x, ...meta } : x
})

cachedRows = { rows: rowsWithMeta, ts: Date.now() }
return NextResponse.json({ ok: true, rows: rowsWithMeta }, { status: 200 })

  } catch (e: any) {
    return NextResponse.json(
      { ok: false, rows: [], error: String(e?.message ?? e) },
      { status: 200 }
    )
  }
}
