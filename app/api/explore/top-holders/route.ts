import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UA = 'ink-dashboard'
const EXPLORER = 'https://explorer.inkonchain.com/api/v2'

async function getJson(url: string, signal: AbortSignal) {
  const r = await fetch(url, {
    signal,
    headers: { accept: 'application/json', 'user-agent': UA },
    cache: 'no-store',
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`${r.status}: ${txt.slice(0, 200)}`)
  return JSON.parse(txt)
}

export async function GET(req: Request) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 20000)

  try {
    const { searchParams } = new URL(req.url)
    const address = String(searchParams.get('address') || '').toLowerCase()
    if (!address) return NextResponse.json({ ok: false, holders: [], error: 'missing address' }, { status: 200 })

    // Try a couple common explorer shapes
    const candidates = [
      `${EXPLORER}/tokens/${address}/holders?items_count=25`,
      `${EXPLORER}/tokens/${address}/token-holders?items_count=25`,
      `${EXPLORER}/tokens/${address}/holders`,
    ]

    let lastErr = ''
    for (const url of candidates) {
      try {
        const j: any = await getJson(url, ac.signal)
        const items = Array.isArray(j?.items) ? j.items : (Array.isArray(j) ? j : [])
// fetch token info so we can compute amount + concentration %
let totalSupplyRaw = 0n
let decimals = 18

try {
  const tj: any = await getJson(`${EXPLORER}/tokens/${address}`, ac.signal)

  const d = Number(tj?.decimals)
  if (Number.isFinite(d) && d >= 0) decimals = d

  const ts = tj?.total_supply ?? tj?.totalSupply ?? tj?.total_supply_raw ?? '0'
  try {
    totalSupplyRaw = BigInt(String(ts))
  } catch {
    totalSupplyRaw = 0n
  }
} catch {
  // keep defaults
}

const formatUnits = (raw: bigint, dec: number) => {
  const d = Math.max(0, Math.min(dec, 30))
  const base = 10n ** BigInt(d)
  const whole = raw / base
  const frac = raw % base

  if (d === 0) return whole.toString()

  // keep up to 6 decimals for UI
  const fracStr = frac.toString().padStart(d, '0').slice(0, 6).replace(/0+$/, '')
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString()
}

const holders = items
  .slice(0, 25)
  .map((it: any, i: number) => {
    const addr = String(it?.address?.hash || it?.address_hash || it?.address || it?.hash || '').toLowerCase()

    const raw = it?.value ?? it?.amount ?? it?.balance ?? it?.token_balance ?? it?.tokenBalance ?? null

    let balRaw = 0n
    try {
      balRaw = raw == null ? 0n : BigInt(String(raw))
    } catch {
      balRaw = 0n
    }

    const value = formatUnits(balRaw, decimals)

    let pct: number | null = null
    if (totalSupplyRaw > 0n) {
      // 4 decimals
      const pctX1e4 = (balRaw * 1000000n) / totalSupplyRaw
      pct = Number(pctX1e4) / 10000
    }

    return { rank: i + 1, address: addr, value, pct }
  })
  .filter((x: any) => x.address)

return NextResponse.json(
  { ok: true, holders, token: { decimals }, sourceUrl: url },
  { status: 200 }
)


      } catch (e: any) {
        lastErr = String(e?.message || e)
      }
    }

    return NextResponse.json({ ok: false, holders: [], error: lastErr }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, holders: [], error: e?.message || 'error' }, { status: 200 })
  } finally {
    clearTimeout(timer)
  }
}
