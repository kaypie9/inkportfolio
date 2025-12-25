import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CHAINS = [
  { name: 'Ink', icon: 'ink' },
  { name: 'Base', icon: 'base' },
  { name: 'Arbitrum', icon: 'arbitrum' },
  { name: 'Linea', icon: 'linea' },
  { name: 'ZKsync Era', icon: 'zksync' },
  { name: 'Scroll', icon: 'scroll' },
  { name: 'Mantle', icon: 'mantle' },
]

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const pct = (now: number | null, prev: number | null) => {
  if (now === null || prev === null || prev === 0) return null
  return ((now - prev) / prev) * 100
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`fetch failed ${res.status}`)
  return res.json()
}

async function fetchChainHistory(chainName: string) {
  // DefiLlama historical chain TVL endpoint
  const url = `https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(chainName)}`
  const j = await fetchJson(url)
  return Array.isArray(j) ? j : []
}

function compute1mPct(series: any[]) {
  if (!Array.isArray(series) || series.length === 0) return null

  const now = Math.floor(Date.now() / 1000)
  const cutoff = now - 30 * 24 * 60 * 60

  let prev: number | null = null
  let latest: number | null = null

  for (let i = 0; i < series.length; i++) {
    const d = toNum(series[i]?.date)
    const v = toNum(series[i]?.tvl)
    if (d === null || v === null) continue

    if (d <= cutoff) prev = v
    latest = v
  }

  if (prev === null || latest === null) return null

  // avoid ridiculous % from dust
  if (prev < 1_000_000) return null

  return pct(latest, prev)
}



export async function GET() {
  try {
    const res = await fetch('https://api.llama.fi/v2/chains', { cache: 'no-store' })
    if (!res.ok) throw new Error('DefiLlama chains fetch failed')

    const all = (await res.json()) as any[]
    const map = new Map<string, any>()
    for (const r of all || []) {
      const name = String(r?.name ?? '').trim()
      if (name) map.set(name.toLowerCase(), r)
    }

    // build base rows
    const baseRows = CHAINS.map(({ name, icon }) => {
      const r = map.get(String(name).toLowerCase()) ?? null
      return {
        name,
        tvl: toNum(r?.tvl) ?? 0,
m1Pct: null as number | null,
        logo: `https://icons.llamao.fi/icons/chains/rsz_${encodeURIComponent(
          icon === 'zksync' ? 'zksync era' : icon
        )}?w=48&h=48`,
      }
    })

// compute 1m % using historical series (limited fanout, still fast with 7 chains)
    const withYtd = await Promise.all(
      baseRows.map(async (row) => {
        try {
          const series = await fetchChainHistory(row.name)
return { ...row, m1Pct: compute1mPct(series) }
        } catch {
          return row
        }
      })
    )

    // Ink always first, then sort others by tvl desc
    const rows = withYtd.sort((a, b) => {
      if (a.name === 'Ink') return -1
      if (b.name === 'Ink') return 1
      return (b.tvl ?? 0) - (a.tvl ?? 0)
    })

    return NextResponse.json({
      ok: true,
      updatedAt: Date.now(),
      rows,
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e), updatedAt: Date.now(), rows: [] },
      { status: 500 }
    )
  }
}
