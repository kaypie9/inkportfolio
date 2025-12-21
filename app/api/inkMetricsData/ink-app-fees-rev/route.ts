import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const pickTotal24h = (obj: any) => {
  // different responses may use different key names, so we try a few
  const keys = [
    'total24h',
    'totalFees24h',
    'totalRevenue24h',
    'total',
    'fees24h',
    'revenue24h',
  ]
  for (const k of keys) {
    const n = toNum(obj?.[k])
    if (n !== null) return n
  }
  return null
}

async function fetchChainMetric(chain: string, dataType: 'dailyFees' | 'dailyRevenue') {
  const url = `https://api.llama.fi/overview/fees/${encodeURIComponent(chain)}?dataType=${dataType}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return { ok: false, url, status: res.status, json: null as any }

  const json = await res.json()
  return { ok: true, url, status: res.status, json }
}

export async function GET() {
  const chain = 'Ink'

  const feesRes = await fetchChainMetric(chain, 'dailyFees')
  const revRes = await fetchChainMetric(chain, 'dailyRevenue')

  if (!feesRes.ok || !revRes.ok) {
    return NextResponse.json(
      { ok: false, chain, feesErr: feesRes.ok ? null : feesRes, revErr: revRes.ok ? null : revRes },
      { status: 500 }
    )
  }

  const chain_fees_24h = pickTotal24h(feesRes.json)
  const chain_revenue_24h = pickTotal24h(revRes.json)

return NextResponse.json({
  ok: true,
  chain,
  app_fees_24h: chain_fees_24h,
  app_revenue_24h: chain_revenue_24h,
  sources: {
    fees: feesRes.url,
    revenue: revRes.url,
  },
  ts: Date.now(),
})
}
