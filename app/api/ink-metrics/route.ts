import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function fetchLocalJson(origin: string, path: string) {
  const url = origin + path
  const res = await fetch(url, { cache: 'no-store' })
  const json = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, url, json }
}

async function getOriginFromHeaders() {
  const h = await headers()
  const host = h.get('host') || 'localhost:3000'
  let proto = h.get('x-forwarded-proto') || 'http'
  if (host.startsWith('localhost')) proto = 'http'
  return `${proto}://${host}`
}

export async function GET() {
  const origin = await getOriginFromHeaders()

  const [
    tvlRes,
    stableRes,
    chainFeesRes,
    appFeesRes,
    dexsRes,
    perpsRes,
    inflowsRes,
    bridgedRes,
  ] = await Promise.all([
    fetchLocalJson(origin, '/api/inkMetricsData/ink-tvl'),
    fetchLocalJson(origin, '/api/inkMetricsData/ink-stablecoins'),
    fetchLocalJson(origin, '/api/inkMetricsData/ink-chain-fees'),
    fetchLocalJson(origin, '/api/inkMetricsData/ink-app-fees-rev'),
    fetchLocalJson(origin, '/api/inkMetricsData/ink-dexs'),
    fetchLocalJson(origin, '/api/inkMetricsData/ink-perps'),
    fetchLocalJson(origin, '/api/inkMetricsData/ink-inflows'),
    fetchLocalJson(origin, '/api/inkMetricsData/ink-bridged-tvl'),
  ])

  const tvl = toNum(tvlRes.json?.tvl)
  const tvlChange24hPct = toNum(tvlRes.json?.tvlChange24hPct)

const keyMetrics = {
  // Stablecoins
  stablecoinsMcap: toNum(stableRes.json?.stablecoins_mcap),
  stablecoinsChange7dPct: toNum(stableRes.json?.change_7d_pct),
  stablecoinsUsdtDominancePct: toNum(stableRes.json?.usdt_dominance_pct),

  // Chain
  chainFees24h: toNum(chainFeesRes.json?.chain_fees_24h),
  chainRevenue24h: toNum(chainFeesRes.json?.chain_revenue_24h),

  // If you still want this extra field, keep it. If not, delete it here and in the card props.
  chainRev24h: toNum(chainFeesRes.json?.chain_rev_24h),

  // Apps
  appRevenue24h: toNum(appFeesRes.json?.app_revenue_24h),
  appFees24h: toNum(appFeesRes.json?.app_fees_24h),

  // DEXs
  dexVolume24h: toNum(dexsRes.json?.dexs_volume_24h),
  dexVolume7d: toNum(dexsRes.json?.volume_7d),
  dexWeeklyChangePct: toNum(dexsRes.json?.weekly_change_pct),

  // Perps
  perpsVolume24h: toNum(perpsRes.json?.perps_volume_24h),
  perpsVolume7d: toNum(perpsRes.json?.volume_7d),
  perpsWeeklyChangePct: toNum(perpsRes.json?.weekly_change_pct),

  // Other
  inflows24h: toNum(inflowsRes.json?.inflows24hUsd),
  bridgedTvl: toNum(bridgedRes.json?.bridged_tvl),
}


  const ok =
    Boolean(tvlRes.ok) &&
    Boolean(stableRes.ok) &&
    Boolean(chainFeesRes.ok) &&
    Boolean(appFeesRes.ok) &&
    Boolean(dexsRes.ok) &&
    Boolean(perpsRes.ok) &&
    Boolean(inflowsRes.ok) &&
    Boolean(bridgedRes.ok)

  return NextResponse.json({
    ok,
    updatedAt: Date.now(),
    tvl,
    tvlChange24hPct,
    keyMetrics,
    sources: {
      tvl: tvlRes.url,
      stablecoins: stableRes.url,
      chainFees: chainFeesRes.url,
      appFees: appFeesRes.url,
      dexs: dexsRes.url,
      perps: perpsRes.url,
      inflows: inflowsRes.url,
      bridgedTvl: bridgedRes.url,
    },
    debug: ok
      ? null
      : {
          tvl: tvlRes.ok ? null : { status: tvlRes.status, url: tvlRes.url },
          stablecoins: stableRes.ok ? null : { status: stableRes.status, url: stableRes.url },
          chainFees: chainFeesRes.ok ? null : { status: chainFeesRes.status, url: chainFeesRes.url },
          appFees: appFeesRes.ok ? null : { status: appFeesRes.status, url: appFeesRes.url },
          dexs: dexsRes.ok ? null : { status: dexsRes.status, url: dexsRes.url },
          perps: perpsRes.ok ? null : { status: perpsRes.status, url: perpsRes.url },
          inflows: inflowsRes.ok ? null : { status: inflowsRes.status, url: inflowsRes.url },
          bridgedTvl: bridgedRes.ok ? null : { status: bridgedRes.status, url: bridgedRes.url },
        },
  })
}
