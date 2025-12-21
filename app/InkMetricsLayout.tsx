'use client'

import { useEffect, useState } from 'react'
import InkTvlCard from './InkTvlCard'
import InkKeyMetricsCard from './InkKeyMetricsCard'
import InkTopProtocols from './InkTopProtocols'
import InkL2ComparisonCard from './InkL2ComparisonCard'

type InkMetricsPayload = {
  ok: boolean
  updatedAt: number
  tvl: number | null
  tvlChange24hPct: number | null
keyMetrics: {
  stablecoinsMcap: number | null
  chainFees24h: number | null
  chainRevenue24h: number | null
  chainRev24h: number | null
  appRevenue24h: number | null
  appFees24h: number | null
  dexVolume24h: number | null
  perpsVolume24h: number | null
  inflows24h: number | null
  bridgedTvl: number | null
}
topProtocols: Array<{
  name: string
  logo: string | null

  tvl: number
  tvl_1d_pct: number | null
  tvl_7d_pct: number | null
  tvl_1m_pct: number | null

  fees_24h: number | null
  fees_7d: number | null
  fees_30d: number | null
  fees_1y: number | null

  spot_volume_24h: number | null
  spot_volume_7d: number | null
  spot_change_7d: number | null
  spot_cumulative_volume: number | null
}>
}

let memInkMetrics: { at: number; data: InkMetricsPayload | null } | null = null
const INK_METRICS_TTL_MS = 5 * 60 * 1000

export default function InkMetricsLayout() {
  const [data, setData] = useState<InkMetricsPayload | null>(null)
  const [loading, setLoading] = useState(true)

useEffect(() => {
  let alive = true

  const now = Date.now()
  if (memInkMetrics && now - memInkMetrics.at < INK_METRICS_TTL_MS) {
    setData(memInkMetrics.data)
    setLoading(false)
    return () => {
      alive = false
    }
  }

  ;(async () => {
    try {
      const res = await fetch('/api/ink-metrics', { cache: 'no-store' })
      const json = (await res.json()) as InkMetricsPayload
      if (!alive) return
      memInkMetrics = { at: Date.now(), data: json }
      setData(json)
    } catch {
      if (!alive) return
      memInkMetrics = { at: Date.now(), data: null }
      setData(null)
    } finally {
      if (!alive) return
      setLoading(false)
    }
  })()

  return () => {
    alive = false
  }
}, [])


  return (
    <div className='ink-metrics-wrap'>
<div className='ink-metrics-top'>
  <div className='ink-metrics-leftcol'>
    <InkTvlCard
      loading={loading}
      tvl={data?.tvl ?? null}
      tvlChange24hPct={data?.tvlChange24hPct ?? null}
    />
    <div style={{ height: 14 }} />
    <InkL2ComparisonCard />
  </div>

  <InkKeyMetricsCard loading={loading} metrics={data?.keyMetrics ?? null} />
</div>



<InkTopProtocols />
    </div>
  )
}
