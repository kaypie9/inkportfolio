import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function pickFirstNum(obj: any, keys: string[]) {
  for (const k of keys) {
    const n = toNum(obj?.[k])
    if (n !== null) return n
  }
  return null
}

function pickChart(json: any): any[] {
  const cands = [
    json?.totalDataChart,
    json?.totalDataChartBreakdown,
    json?.chart,
    json?.data,
    json?.totalChart,
  ]
  for (const c of cands) if (Array.isArray(c)) return c
  return []
}

function normDay(rawTs: any) {
  const n = Number(rawTs)
  if (!Number.isFinite(n) || n <= 0) return null
  const sec = n > 1e12 ? Math.floor(n / 1000) : Math.floor(n)
  return Math.floor(sec / 86400) * 86400
}

function sumLastNDaysFromChart(chart: any[], days: number) {
  const rows = chart
    .map((r: any) => {
      if (!Array.isArray(r) || r.length < 2) return null
      const day = normDay(r[0])
      const val = toNum(r[1])
      if (!day || val === null) return null
      return { day, val }
    })
    .filter((x): x is { day: number; val: number } => x !== null)
    .sort((a, b) => a.day - b.day)

  if (!rows.length) return null

  const nowSec = Math.floor(Date.now() / 1000)
  const todayMidnight = Math.floor(nowSec / 86400) * 86400
  const fullDays = rows.filter((r) => r.day < todayMidnight)

  if (fullDays.length < days) return null

  const slice = fullDays.slice(-days)
  let sum = 0
  for (const r of slice) sum += r.val
  return sum
}

export async function GET() {
  const chain = 'Ink'

  const overviewUrl = `https://api.llama.fi/overview/dexs/${encodeURIComponent(chain)}`
  const chartUrls = [
    `https://api.llama.fi/overview/dexs/${encodeURIComponent(chain)}?dataType=dailyVolume`,
    `https://api.llama.fi/overview/dexs/${encodeURIComponent(chain)}?dataType=dailyVolumes`,
    `https://api.llama.fi/overview/dexs/${encodeURIComponent(chain)}?dataType=daily`,
  ]

  try {
    // 1) overview (fast path for 24h + sometimes 7d)
    const res = await fetch(overviewUrl, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, chain, dexs_volume_24h: null, error: { url: overviewUrl, status: res.status } },
        { status: 500 }
      )
    }

    const json: any = await res.json()

    const dexs24h =
      pickFirstNum(json, ['totalVolume24h', 'volume24h', 'dexsVolume24h', 'dexVolume24h', 'total24h']) ??
      null

    // sometimes exists already
    let vol7d =
      pickFirstNum(json, ['totalVolume7d', 'volume7d', 'total7d', 'totalVolumeLast7d', 'volume_7d']) ?? null

    let weeklyChangePct =
      pickFirstNum(json, ['weeklyChange', 'weeklyChangePct', 'weekly_change_pct', 'change7d', 'change_7d_pct']) ??
      null

    // 2) chart fallback for 7d + weekly change
    let chartPicked: any = null

    for (const u of chartUrls) {
      const r = await fetch(u, { cache: 'no-store' })
      if (!r.ok) continue
      const j: any = await r.json()
      const chart = pickChart(j)

      const this7d = sumLastNDaysFromChart(chart, 7)
      const prev7d = sumLastNDaysFromChart(chart, 14)

      if (this7d !== null && prev7d !== null) {
        const prevOnly = prev7d - this7d
        if (prevOnly > 0) {
          vol7d = this7d
          weeklyChangePct = ((this7d - prevOnly) / prevOnly) * 100
          chartPicked = u
          break
        }
        // if prevOnly is 0 or negative, still set 7d if missing
        if (vol7d === null) vol7d = this7d
        chartPicked = u
      }
    }

    return NextResponse.json({
      ok: true,
      chain,
      dexs_volume_24h: dexs24h,
      volume_7d: vol7d,
      weekly_change_pct: weeklyChangePct,
      source: overviewUrl,
      chart_source: chartPicked,
      ts: Date.now(),
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, chain, dexs_volume_24h: null, error: { url: overviewUrl, msg: e?.message || String(e) } },
      { status: 500 }
    )
  }
}
