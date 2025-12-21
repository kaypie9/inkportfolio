'use client'

import React from 'react'

function formatUsdCompact(n: number): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 1,
      notation: 'compact',
    }).format(n)
  } catch {
    return '$' + Math.round(n).toString()
  }
}

function show(v: number | null, loading: boolean): React.ReactNode {
  if (loading) return <span className='ink-skeleton' />
  if (v == null) return '—'
  return formatUsdCompact(v)
}


export default function InkKeyMetricsCard(props: {
  loading: boolean
  metrics: {
    stablecoinsMcap: number | null
    chainFees24h: number | null
    chainRevenue24h: number | null
    appRevenue24h: number | null
    appFees24h: number | null
    dexVolume24h: number | null
    perpsVolume24h: number | null
    inflows24h: number | null
    bridgedTvl: number | null

    // optional extra lines (safe if missing)
    stablecoinsChange7dPct?: number | null
    stablecoinsUsdtDominancePct?: number | null

    dexVolume7d?: number | null
    dexWeeklyChangePct?: number | null

    perpsVolume7d?: number | null
    perpsWeeklyChangePct?: number | null
  } | null
}) {
  const { loading, metrics } = props

  const [open, setOpen] = React.useState<Record<string, boolean>>({})

  const toggle = (key: string) => {
    setOpen((p) => ({ ...p, [key]: !p[key] }))
  }

const fmtPct = (n: number | null) => {
  if (loading) return <span className='ink-skeleton ink-skeleton-sm' />
  if (n == null) return '—'
  const s = n >= 0 ? '+' : ''
  return `${s}${n.toFixed(2)}%`
}


const fmtPctPlain = (n: number | null) => {
  if (loading) return <span className='ink-skeleton ink-skeleton-sm' />
  if (n == null) return '—'
  return `${n.toFixed(2)}%`
}


const Row = (p: {
  k: string
  label: string
  value: React.ReactNode
  expandable?: boolean
  details?: { label: string; value: React.ReactNode; positive?: boolean | null }[]
}) => {
  const isOpen = !!open[p.k]
  const hasDetails = Array.isArray(p.details) && p.details.length > 0
  const canOpen = !!p.expandable && hasDetails

  const Top = canOpen ? 'button' : 'div'
  const topProps = canOpen
    ? {
        type: 'button' as const,
        onClick: () => toggle(p.k),
        'aria-expanded': isOpen,
      }
    : {}

  return (
    <div className='ink-km-item'>
      <Top className={'ink-km-top' + (canOpen ? '' : ' is-static')} {...topProps}>
<span className='ink-km-left'>
  <span className='ink-km-label'>
    <span className='ink-km-text'>{p.label}</span>

    {canOpen ? (
      <span className={'ink-km-chevron after' + (isOpen ? ' is-open' : '')}>
        <svg viewBox='0 0 20 20' width='14' height='14' aria-hidden='true'>
          <path
            d='M5.5 7.5L10 12l4.5-4.5'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </span>
    ) : null}
  </span>
</span>




        <span className='ink-km-value'>{p.value}</span>
      </Top>

      {canOpen && isOpen ? (
        <div className='ink-km-details'>
          {p.details!.map((d, i) => (
            <div className='ink-km-detail' key={p.k + '-' + i}>
              <span className='ink-km-detail-label'>{d.label}</span>
              <span
                className={
                  'ink-km-detail-value' +
                  (d.positive === true ? ' is-pos' : '') +
                  (d.positive === false ? ' is-neg' : '')
                }
              >
                {d.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}


  return (
    <div className='ink-card ink-card-hero'>
      <div className='ink-card-header'>
        <span className='ink-card-title'>Key Metrics</span>
      </div>

      <div className='ink-km-list'>
<Row
  k='stablecoins'
  label='Stablecoins Mcap'
  value={show(metrics?.stablecoinsMcap ?? null, loading)}
  expandable
  details={[
            {
              label: 'Change (7d)',
              value: fmtPct(metrics?.stablecoinsChange7dPct ?? null),
              positive:
                (metrics?.stablecoinsChange7dPct ?? null) == null
                  ? null
                  : (metrics!.stablecoinsChange7dPct as number) >= 0,
            },
{
  label: 'USDT Dominance',
  value: fmtPctPlain(metrics?.stablecoinsUsdtDominancePct ?? null),
  positive: null,
}

          ]}
        />

        <Row
          k='chainFees24h'
          label='Chain Fees (24h)'
          value={show(metrics?.chainFees24h ?? null, loading)}
        />

        <Row
          k='chainRevenue24h'
          label='Chain Revenue (24h)'
          value={show(metrics?.chainRevenue24h ?? null, loading)}
        />

        <Row
          k='appRevenue24h'
          label='App Revenue (24h)'
          value={show(metrics?.appRevenue24h ?? null, loading)}
        />

        <Row
          k='appFees24h'
          label='App Fees (24h)'
          value={show(metrics?.appFees24h ?? null, loading)}
        />

<Row
  k='dex'
  label='DEXs Volume (24h)'
  value={show(metrics?.dexVolume24h ?? null, loading)}
  expandable
  details={[
            {
              label: 'Volume (7d)',
              value: show(metrics?.dexVolume7d ?? null, loading),
              positive: null,
            },
            {
              label: 'Weekly Change',
              value: fmtPct(metrics?.dexWeeklyChangePct ?? null),
              positive:
                (metrics?.dexWeeklyChangePct ?? null) == null
                  ? null
                  : (metrics!.dexWeeklyChangePct as number) >= 0,
            },
          ]}
        />

<Row
  k='perps'
  label='Perps Volume (24h)'
  value={show(metrics?.perpsVolume24h ?? null, loading)}
  expandable
  details={[
            {
              label: 'Perps Volume (7d)',
              value: show(metrics?.perpsVolume7d ?? null, loading),
              positive: null,
            },
            {
              label: 'Weekly Change',
              value: fmtPct(metrics?.perpsWeeklyChangePct ?? null),
              positive:
                (metrics?.perpsWeeklyChangePct ?? null) == null
                  ? null
                  : (metrics!.perpsWeeklyChangePct as number) >= 0,
            },
          ]}
        />

        <Row
          k='inflows24h'
          label='Inflows (24h)'
          value={show(metrics?.inflows24h ?? null, loading)}
        />

        <Row
          k='bridgedTvl'
          label='Bridged TVL'
          value={show(metrics?.bridgedTvl ?? null, loading)}
        />
      </div>
    </div>
  )
}
