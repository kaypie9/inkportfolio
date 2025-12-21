import { NextResponse } from 'next/server'
import { fetchInkPerpsSources, sumPerpsVolume24hUsd } from '@/lib/inkPerpsFallback'

export const dynamic = 'force-dynamic'

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function pick24h(obj: any) {
  const keys = ['totalVolume24h', 'volume24h', 'perpsVolume24h', 'perpVolume24h', 'total24h']
  for (const k of keys) {
    const n = toNum(obj?.[k])
    if (n !== null) return n
  }
  return null
}

function pickDayValue(row: any) {
  // handle [ts, value]
  if (Array.isArray(row)) {
    for (let i = row.length - 1; i >= 0; i--) {
      const n = toNum(row[i])
      if (n !== null) return n
    }
    return null
  }

  return (
    toNum(row?.totalVolume) ??
    toNum(row?.totalVolumeUsd) ??
    toNum(row?.volume) ??
    toNum(row?.value) ??
    toNum(row?.dailyVolume) ??
    toNum(row?.total) ??
    null
  )
}

function normalizeChart(json: any): any[] {
  if (Array.isArray(json)) return json

  // common DefiLlama chart keys
  if (Array.isArray(json?.totalDataChart)) return json.totalDataChart
  if (Array.isArray(json?.totalDataChartUSD)) return json.totalDataChartUSD
  if (Array.isArray(json?.totalDataChartUsd)) return json.totalDataChartUsd

  // sometimes wrapped
  if (Array.isArray(json?.chart)) return json.chart
  if (Array.isArray(json?.data)) return json.data
  if (Array.isArray(json?.volumes)) return json.volumes

  // sometimes nested one level
  if (Array.isArray(json?.data?.chart)) return json.data.chart
  if (Array.isArray(json?.data?.data)) return json.data.data

  return []
}


export async function GET() {
  const chain = 'Ink'
  const baseUrl = `https://api.llama.fi/overview/derivatives/${chain}`
  const chartUrl = `${baseUrl}?dataType=dailyVolume`

  try {
    // 1) 24h (main number)
    const res = await fetch(baseUrl, { cache: 'no-store' })
if (!res.ok) {
  throw new Error(`defillama ${res.status}`)
}


    const json: any = await res.json()
    const v24 = pick24h(json)
if (v24 === null) {
  throw new Error('defillama missing 24h')
}


    // 2) chart for 7d + weekly change
    let volume7d: number | null = null
    let weeklyChangePct: number | null = null

    try {
      const cr = await fetch(chartUrl, { cache: 'no-store' })
      if (cr.ok) {
        const cj: any = await cr.json()
        const arr = normalizeChart(cj)
          .map((x) => pickDayValue(x))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))

        if (arr.length >= 14) {
          const last7 = arr.slice(-7).reduce((a, b) => a + b, 0)
          const prev7 = arr.slice(-14, -7).reduce((a, b) => a + b, 0)

          volume7d = last7
          if (prev7 > 0) weeklyChangePct = ((last7 - prev7) / prev7) * 100
        } else if (arr.length >= 7) {
          volume7d = arr.slice(-7).reduce((a, b) => a + b, 0)
        }
      }
    } catch {}

    return NextResponse.json({
      ok: true,
      chain,
      perps_volume_24h: v24,
      volume_7d: volume7d,
      weekly_change_pct: weeklyChangePct,
      source: baseUrl,
      chart_source: chartUrl,
      ts: Date.now(),
    })
} catch (e: any) {
  try {
    const sources = await fetchInkPerpsSources()
    const fallback24h = sumPerpsVolume24hUsd(sources)

    if (fallback24h === null) {
      throw new Error('fallback returned null')
    }

    return NextResponse.json({
      ok: true,
      chain,
      perps_volume_24h: fallback24h,
      volume_7d: null,
      weekly_change_pct: null,
      source: 'fallback',
      ts: Date.now(),
    })
  } catch (e2: any) {
    return NextResponse.json(
      {
        ok: false,
        chain,
        perps_volume_24h: null,
        error: {
          msg: e2?.message || String(e2),
        },
      },
      { status: 500 }
    )
  }
}
}
