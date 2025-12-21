'use client'

import { useState } from 'react'
import InkTvlChartModal from './InkTvlChartModal'

function formatUsdCompact(n: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      notation: 'compact',
    }).format(n)
  } catch {
    return '$' + Math.round(n).toString()
  }
}


export default function InkTvlCard(props: {
  loading: boolean
  tvl: number | null
  tvlChange24hPct: number | null
}) {
  const { loading, tvl, tvlChange24hPct } = props
  const [openChart, setOpenChart] = useState(false)

  const usdDelta =
  !loading && tvl != null && tvlChange24hPct != null
    ? (tvl * tvlChange24hPct) / 100
    : null

const usdDeltaText =
  usdDelta == null
    ? ''
    : `${usdDelta >= 0 ? '+' : '-'}${formatUsdCompact(Math.abs(usdDelta))}`

  const deltaClass =
    tvlChange24hPct == null
      ? 'neutral'
      : tvlChange24hPct > 0
      ? 'positive'
      : tvlChange24hPct < 0
      ? 'negative'
      : 'neutral'

  return (
    <>
<div className='ink-card ink-card-hero'>

<div className="ink-card-header">
  <span className="ink-card-title">Total Value Locked in DeFi</span>

  <button
    type="button"
    className="ink-tvl-chartbtn"
    onClick={(e) => {
      e.stopPropagation()
      setOpenChart(true)
    }}
  >
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M4 19V5M4 19H20M7 15l3-3 3 2 4-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <span className="ink-tvl-charttext">View chart</span>
  </button>
</div>



        <div className='ink-tvl-main-row'>
          <div className='ink-tvl-left'>
            <div className='ink-card-value'>
              {loading ? (
                <span className='ink-skeleton ink-skeleton-xl' />
              ) : tvl == null ? (
                '—'
              ) : (
                formatUsdCompact(tvl)
              )}
            </div>
          </div>

          <div
            className={`ink-tvl-right ink-tvl-flash ${deltaClass}`}
            key={`${tvl ?? 'x'}-${tvlChange24hPct ?? 'x'}`}
          >
            <div className='ink-tvl-change-label'>24h change</div>

            {loading ? (
              <span className='ink-skeleton ink-skeleton-sm' />
            ) : tvlChange24hPct == null ? (
              <span className='ink-tvl-change neutral'>—</span>
            ) : (
              <span className={`ink-tvl-change ${deltaClass}`} title={usdDeltaText}>
                <span className='ink-tvl-arrow' aria-hidden='true'>
                  {tvlChange24hPct >= 0 ? '▲' : '▼'}
                </span>
                {tvlChange24hPct >= 0 ? '+' : ''}
                {tvlChange24hPct.toFixed(2)}%
              </span>
            )}

            {!loading && usdDelta != null ? (
              <div className={`ink-tvl-net ${deltaClass}`}>
                {usdDelta >= 0 ? '+' : '-'}
                {formatUsdCompact(Math.abs(usdDelta))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <InkTvlChartModal open={openChart} onClose={() => setOpenChart(false)} />
    </>
  )
}
