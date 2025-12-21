'use client'

import { useEffect, useMemo, useState } from 'react'

type Row = { name: string; tvl: number; ytdPct?: number | null; logo?: string | null }

let memL2Rows: { at: number; rows: Row[] } | null = null
const L2_TTL_MS = 5 * 60 * 1000

const fmtUsd = (n: number) => {
  if (!Number.isFinite(n)) return '$0'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const fmtPctCap = (n: number | null | undefined) => {
  if (n === null || n === undefined) return ''
  if (!Number.isFinite(n)) return ''

  const cap = 9999
  if (n >= cap) return `> +${cap}%`
  if (n <= -cap) return `< -${cap}%`

  const s = n >= 0 ? '+' : ''
  return `${s}${n.toFixed(0)}%`
}

const sortInkFirst = (rows: Row[]) => {
  return [...rows].sort((a, b) => {
    if (a.name === 'Ink') return -1
    if (b.name === 'Ink') return 1
    return 0
  })
}

export default function InkL2ComparisonCard() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(true)

useEffect(() => {
  let alive = true

  const now = Date.now()
  if (memL2Rows && now - memL2Rows.at < L2_TTL_MS) {
    setRows(memL2Rows.rows)
    setLoading(false)
    return () => {
      alive = false
    }
  }

  ;(async () => {
    try {
      const res = await fetch('/api/inkMetricsData/l2-tvl-comparison', { cache: 'no-store' })
      const j = await res.json()
      if (!alive) return
      const out = Array.isArray(j?.rows) ? j.rows : []
      memL2Rows = { at: Date.now(), rows: out }
      setRows(out)
    } catch {
      if (!alive) return
      memL2Rows = { at: Date.now(), rows: [] }
      setRows([])
    } finally {
      if (!alive) return
      setLoading(false)
    }
  })()

  return () => {
    alive = false
  }
}, [])


  const max = useMemo(() => {
    const m = Math.max(...((rows ?? []).map((r) => r.tvl)), 1)
    return m
  }, [rows])

  return (
    <div className='ink-card ink-card-box'>
      <div className='ink-card-clip'>
        <div className='ink-card-header' style={{ marginBottom: 6 }}>
  <span className='ink-card-title'>L2 TVL Comparison</span>
<span className='ink-l2-subtitle'>YTD growth</span>

</div>


        {loading ? (
          <div style={{ paddingTop: 6 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className='ink-l2-row'>
                <span className='ink-skeleton ink-skeleton-md' />
                <span className='ink-skeleton ink-skeleton-lg' />
                <span className='ink-skeleton ink-skeleton-sm' />
              </div>
            ))}
          </div>
        ) : (
          <div className='ink-l2-list'>
{sortInkFirst(rows ?? []).map((r) => {
              const pct = Math.max(0, Math.min(100, (r.tvl / max) * 100))
              return (
                <div key={r.name} className='ink-l2-item'>
<div className='ink-l2-left'>
  <span className='ink-l2-logo'>
    {r.logo ? (
      <img
        src={r.logo}
        alt=''
        width={18}
        height={18}
        style={{ borderRadius: 6, display: 'block' }}
      />
    ) : (
      <span className='ink-l2-logo-ph' />
    )}
  </span>
  <span>{r.name}</span>
</div>

                  <div className='ink-l2-bar'>
                    <div className='ink-l2-barTrack'>
<div
  className={`ink-l2-barFill ${r.name === 'Ink' ? 'is-ink' : 'is-other'}`}
  style={{ width: `${pct}%` }}
/>
                    </div>
                  </div>

<div className='ink-l2-right' style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
  <span>{fmtUsd(r.tvl)}</span>
  {r.ytdPct !== null && r.ytdPct !== undefined && (
<span className={'ink-l2-ytd ' + (r.name === 'Ink' ? 'is-ink' : 'is-other')}>
  {r.ytdPct == null ? '—' : fmtPctCap(r.ytdPct)}
</span>



  )}
</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
