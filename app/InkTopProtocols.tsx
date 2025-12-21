'use client'

import { useEffect, useMemo, useState, useRef } from 'react'

let memRows: any[] | null = null

const fmtUsd = (n: number | null) => {
  if (n === null) return ''

  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}m`
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}



const fmtPct = (n: number | null) => {
  if (n === null) return ''

  // hide 0.00%
  if (Math.abs(n) < 0.005) return ''

  const s = n >= 0 ? '+' : ''
  return `${s}${n.toFixed(2)}%`
}



export default function ProtocolRankingsTable() {
const mainScrollRef = useRef<HTMLDivElement | null>(null)
const hScrollRef = useRef<HTMLDivElement | null>(null)
const hInnerRef = useRef<HTMLDivElement | null>(null)
const stickyHeadRef = useRef<HTMLDivElement | null>(null)
const stickyInnerRef = useRef<HTMLDivElement | null>(null)

const [rows, setRows] = useState<any[]>([])
const [expanded, setExpanded] = useState<Record<string, boolean>>({})
const [loading, setLoading] = useState(true)

const [sortBy, setSortBy] = useState<string>('tvl')
const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
const [advancedCols, setAdvancedCols] = useState(false)


const toggleSort = (key: string) => {
if (sortBy === key) {
setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
} else {
setSortBy(key)
setSortDir('desc')
}
}

const sortMark = (key: string) => {
  if (sortBy !== key) return '↕'
  return sortDir === 'desc' ? '↓' : '↑'
}



const ALL_HEADER = [
  { key: 'tvl', label: 'TVL' },
  { key: 'change_1d_pct', label: '1d change' },
  { key: 'change_7d_pct', label: '7d change' },
  { key: 'change_1m_pct', label: '1m change' },
  { key: 'fees_24h', label: 'Fees 24h' },
  { key: 'fees_7d', label: 'Fees 7d' },
  { key: 'fees_30d', label: 'Fees 30d' },
  { key: 'fees_1y', label: 'Fees 1y' },
  { key: 'spot_volume_24h', label: 'Spot Vol 24h' },
  { key: 'spot_volume_7d', label: 'Spot Vol 7d' },
  { key: 'spot_change_7d', label: 'Spot Change 7d' },
  { key: 'spot_cumulative_volume', label: 'Spot Cumulative' },
]

const BASE_HEADER = [
  { key: 'tvl', label: 'TVL' },
  { key: 'change_1d_pct', label: '1d change' },
  { key: 'fees_24h', label: 'Fees 24h' },
  { key: 'spot_volume_24h', label: 'Spot Vol 24h' },
]

const HEADER = advancedCols ? ALL_HEADER : BASE_HEADER

const COL_W = advancedCols
  ? [
      50, 260, 170,
      130, 130, 130, 130,
      140, 140, 140, 130,
      150, 150, 160, 160,
    ]
  : [
      50, 260, 170,
      140, 130, 130, 150,
    ]


const sortedRows = useMemo(() => {
const getVal = (r: any) => {
const v = r?.[sortBy]
if (v === null || v === undefined) return -Infinity
return typeof v === 'number' ? v : 0
}

const top = [...rows].sort((a, b) => {
const av = getVal(a)
const bv = getVal(b)
return sortDir === 'desc' ? bv - av : av - bv
})

return top.map(p => {
const kids = Array.isArray(p?.children) ? [...p.children] : []
kids.sort((a, b) => {
const av = getVal(a)
const bv = getVal(b)
return sortDir === 'desc' ? bv - av : av - bv
})
return { ...p, children: kids }
})
}, [rows, sortBy, sortDir])

const flatRows = useMemo(() => {
const out: {
row: any
depth: number
isChild: boolean
parentSlug?: string
}[] = []

for (const r of sortedRows) {
out.push({ row: r, depth: 0, isChild: false })

const kids = Array.isArray(r?.children) ? r.children : []
if (expanded[r.slug] && kids.length) {
  for (const c of kids) out.push({ row: c, depth: 1, isChild: true, parentSlug: r.slug })
}


}

return out
}, [sortedRows, expanded])

useEffect(() => {
  // if we already loaded once in this session, do not refetch on navigation
  if (memRows) {
    setRows(memRows)
    setLoading(false)
    return
  }

  let alive = true
  const ac = new AbortController()
const timer = setTimeout(() => {
  if (!ac.signal.aborted) ac.abort()
}, 20000)

  setLoading(true)

  ;(async () => {
    try {
      const r = await fetch('/api/inkMetricsData/ink-protocol-rankings', {
        signal: ac.signal,
        cache: 'no-store',
      })

const text = await r.text()

if (!r.ok) {
  console.error('rankings 500 body:', text)
  throw new Error(`rankings http ${r.status}: ${text.slice(0, 200) || 'empty'}`)
}

let j: any
try {
  j = JSON.parse(text)
} catch {
  throw new Error('rankings bad json: ' + text.slice(0, 200))
}



      if (!alive) return
      const nextRows = Array.isArray(j?.rows) ? j.rows : []
      memRows = nextRows
      setRows(nextRows)
    } catch (err) {
      console.error(err)
      if (!alive) return
      memRows = []
      setRows([])
    } finally {
      clearTimeout(timer)
      if (alive) setLoading(false)
    }
  })()

  return () => {
    alive = false
    clearTimeout(timer)
  }
}, [])



useEffect(() => {
  const main = mainScrollRef.current
  const h = hScrollRef.current
  const hInner = hInnerRef.current
  if (!main || !h || !hInner) return

 const syncWidth = () => {
  const w = main.scrollWidth + 'px'
  hInner.style.width = w

  const sticky = stickyInnerRef.current
  if (sticky) sticky.style.width = w
}


  syncWidth()
  const ro = new ResizeObserver(syncWidth)
  ro.observe(main)
  
if (main.firstElementChild) ro.observe(main.firstElementChild as Element)

const onMain = () => {
  if (h.scrollLeft !== main.scrollLeft) h.scrollLeft = main.scrollLeft

  const inner = stickyInnerRef.current
  if (inner) inner.style.transform = `translateX(${-main.scrollLeft}px)`
}

  const onH = () => {
    if (main.scrollLeft !== h.scrollLeft) main.scrollLeft = h.scrollLeft
  }
  
  requestAnimationFrame(onMain)

  main.addEventListener('scroll', onMain)
  h.addEventListener('scroll', onH)

  return () => {
    ro.disconnect()
    main.removeEventListener('scroll', onMain)
    h.removeEventListener('scroll', onH)
  }
}, [loading, rows.length, advancedCols])


const isPctKey = (k: string) => k.includes('change') || k.endsWith('_pct')

const cellText = (r: any, k: string) => {
  const v = r?.[k]
  if (v === null || v === undefined) return ''
  return isPctKey(k) ? fmtPct(v) : fmtUsd(v)
}

const cellClass = (r: any, k: string) => {
  if (!isPctKey(k)) return 'num'
  const v = r?.[k]
  if (v === null || v === undefined) return 'num'
  return 'num ' + (v >= 0 ? 'pos' : 'neg')
}

const renderHeadRow = () => (
  <thead>
    <tr>
      <th>#</th>
<th className='namecell namehead'>
  <div className='namecellInner head'>
    <span className='logo ph' style={{ width: 28, height: 28, borderRadius: 8 }} />
    <span>Name</span>
  </div>
</th>
      <th>Category</th>

      {HEADER.map((h) => (
        <th key={h.key} className='num'>
          <button
            type='button'
            className={'thbtn' + (sortBy === h.key ? ' active' : '')}
            onClick={() => toggleSort(h.key)}
          >
            <span className='th-label'>{h.label}</span>
            <span className='th-arrow'>{sortMark(h.key)}</span>
          </button>
        </th>
      ))}
    </tr>
  </thead>
)


return (
  <div className='ink-metrics-grid'>
    <div className='ink-card ink-card-box ink-card-protocols'>
      <div className='ink-card-clip'>
<div className='ink-card-header'>
  <span className='ink-card-title'>Protocol Rankings</span>

  <div className='ink-card-header-right'>
    <button
      type='button'
      className={'km-toggle' + (advancedCols ? ' on' : '')}
onClick={() => {
  setAdvancedCols(v => !v)

  requestAnimationFrame(() => {
    const main = mainScrollRef.current
    const hInner = hInnerRef.current
    if (main && hInner) {
      hInner.style.width = main.scrollWidth + 'px'
    }
  })
}}
    >
      {advancedCols ? 'advanced on' : 'advanced off'}
    </button>
  </div>
</div>


{loading ? (
  <div className='ink-protocols-skel'>
    <div className='ink-protocols-skel-head'>
      <span className='ink-skeleton ink-skeleton-xs' />
      <span className='ink-skeleton ink-skeleton-md' />
      <span className='ink-skeleton ink-skeleton-sm' />
      <span className='ink-skeleton ink-skeleton-sm' />
    </div>

    <div className='ink-protocols-skel-list'>
      {Array.from({ length: 8 }).map((_, i) => (
        <div className='ink-protocols-skel-row' key={i}>
          <span className='ink-skeleton ink-skeleton-xs' />
          <span className='ink-skeleton ink-skeleton-logo' />
          <span className='ink-skeleton ink-skeleton-lg' />
          <span className='ink-skeleton ink-skeleton-md' />
          <span className='ink-skeleton ink-skeleton-sm' />
          <span className='ink-skeleton ink-skeleton-sm' />
        </div>
      ))}
    </div>
  </div>
) : (
  <div className='ink-protocols-wrap'>
{/* sticky table header clone */}
<div ref={stickyHeadRef} className='ink-protocols-stickyhead'>
  <div ref={stickyInnerRef} className='ink-protocols-stickyinner'>
<table className='table' style={{ tableLayout: 'fixed' }}>
      <colgroup>
        {COL_W.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
      </colgroup>

      {renderHeadRow()}
    </table>
  </div>
</div>

<div ref={mainScrollRef} className='ink-protocols-list'>
<table className='table' style={{ tableLayout: 'fixed' }}>

    <colgroup>
      {COL_W.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>

<thead className='sr-thead'>
  <tr>
    <th />
    <th />
    <th />
    {HEADER.map((h) => (
      <th key={h.key} />
    ))}
  </tr>
</thead>



    <tbody>
      {flatRows.map(({ row: r, depth, isChild, parentSlug }, i) => (
        <tr key={(parentSlug ? parentSlug + '::' : '') + r.slug}>
          <td>{isChild ? '' : i + 1}</td>

          <td className={'namecell' + (isChild ? ' child' : '')}>
            <div className='namecellInner' style={{ paddingLeft: depth ? 18 : 0 }}>
              {!isChild && Array.isArray(r?.children) && r.children.length > 1 ? (
                <button
                  className={'expbtn' + (expanded[r.slug] ? ' open' : '')}
                  onClick={() => setExpanded((x) => ({ ...x, [r.slug]: !x[r.slug] }))}
                  aria-label='toggle'
                >
                  ▸
                </button>
              ) : (
                <span className='expbtn ph' />
              )}

              {r.logo ? (
                <img
                  className='logo'
                  src={r.logo}
                  alt=''
                  style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span className='logo ph' style={{ width: 28, height: 28, borderRadius: 8 }} />
              )}

              <span>{r.name}</span>
            </div>
          </td>

          <td className='muted'>{r.category ?? '–'}</td>

{HEADER.map(h => (
  <td key={h.key} className={cellClass(r, h.key)}>
    {cellText(r, h.key)}
  </td>
))}

        </tr>
      ))}
    </tbody>
  </table>
</div>
{/* sticky bottom scrollbar */}
<div ref={hScrollRef} className='ink-hscroll'>
  <div ref={hInnerRef} />
</div>
          </div>
        )}
      </div>
    </div>
  </div>
)
}