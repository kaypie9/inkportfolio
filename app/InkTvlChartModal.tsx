'use client'

import React from 'react'

type Point = { date: number; tvl: number }

let memTvlSeries: { at: number; points: Point[] } | null = null
const TVL_SERIES_TTL_MS = 60 * 60 * 1000

function fmtUsdCompact(n: number): string {
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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function niceStep(raw: number) {
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const n = raw / pow
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return m * pow
}

function niceCeil(v: number, step: number) {
  if (!Number.isFinite(v) || !Number.isFinite(step) || step <= 0) return v
  return Math.ceil(v / step) * step
}

function pickRange(points: Point[], range: string) {
  if (!points.length) return points
  if (range === 'all') return points

  const now = points[points.length - 1].date
  const days =
    range === '7d' ? 7 : range === '1m' ? 30 : range === '3m' ? 90 : range === '1y' ? 365 : 30

  const minT = now - days * 24 * 60 * 60 * 1000
  const cut = points.findIndex((p) => p.date >= minT)
  return points.slice(Math.max(0, cut))
}

export default function InkTvlChartModal(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props

  const [range, setRange] = React.useState<'7d' | '1m' | '3m' | '1y' | 'all'>('1y')
  const [loading, setLoading] = React.useState(false)
  const [points, setPoints] = React.useState<Point[]>([])
  const [err, setErr] = React.useState<string | null>(null)

  const wrapRef = React.useRef<HTMLDivElement | null>(null)
  const [w, setW] = React.useState(0)

  const [hover, setHover] = React.useState<{ i: number; x: number; y: number } | null>(null)
  const [win, setWin] = React.useState<{ a: number; b: number }>({ a: 0, b: 0 })
  const [dragging, setDragging] = React.useState(false)
  const dragRef = React.useRef<{ x: number; a: number; b: number } | null>(null)

React.useEffect(() => {
  if (!open) return

  const now = Date.now()

  // use cached points if still fresh
  if (memTvlSeries && now - memTvlSeries.at < TVL_SERIES_TTL_MS && memTvlSeries.points.length) {
    setPoints(memTvlSeries.points)
    setErr(null)
    setLoading(false)
    return
  }

  setLoading(true)
  setErr(null)

  ;(async () => {
    try {
      const r = await fetch('/api/inkMetricsData/ink-tvl-series', { cache: 'no-store' })
      const j = await r.json()
      const next = Array.isArray(j?.points) ? (j.points as Point[]) : []

      // if we got good data, cache it
      if (next.length) {
        memTvlSeries = { at: Date.now(), points: next }
      }

      setPoints(next.length ? next : memTvlSeries?.points ?? [])
    } catch (e: any) {
      setErr(String(e?.message ?? e ?? 'fetch failed'))

      // fallback to last cached data instead of empty
      setPoints(memTvlSeries?.points ?? [])
    } finally {
      setLoading(false)
    }
  })()
}, [open])


  React.useEffect(() => {
    if (!open) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  React.useEffect(() => {
    if (!open) return
    const el = wrapRef.current
    if (!el) return

    const ro = new ResizeObserver(() => setW(el.clientWidth || 0))
    ro.observe(el)
    setW(el.clientWidth || 0)
    return () => ro.disconnect()
  }, [open])

const baseView = React.useMemo(() => pickRange(points, range), [points, range])

const view = React.useMemo(() => {
  if (!baseView.length) return baseView
  const a = clamp(win.a, 0, baseView.length - 1)
  const b = clamp(win.b, a, baseView.length - 1)
  return baseView.slice(a, b + 1)
}, [baseView, win.a, win.b])

React.useEffect(() => {
  setWin({ a: 0, b: Math.max(0, baseView.length - 1) })
  setHover(null)
}, [range, baseView.length, open])

React.useEffect(() => {
  if (!open) return
  const prev = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  return () => {
    document.body.style.overflow = prev
  }
}, [open])

  const h = 340
  const padL = 52
  const padR = 8
  const padT = 10
  const padB = 22

const minMax = React.useMemo(() => {
  let max = 0
  for (const p of view) {
    if (Number.isFinite(p.tvl) && p.tvl > max) max = p.tvl
  }

  if (!Number.isFinite(max) || max <= 0) return { min: 0, max: 1 }

  const ticks = 5
  const rawStep = max / (ticks - 1)
  const step = niceStep(rawStep)
  const niceMax = niceCeil(max, step)

  return { min: 0, max: niceMax }
}, [view])


  const svgW = Math.max(260, w)
  const innerW = svgW - padL - padR
  const innerH = h - padT - padB

  const pts = React.useMemo(() => {
    if (!view.length) return []
    const x0 = view[0].date
    const x1 = view[view.length - 1].date
    const dx = x1 - x0 || 1
    const dy = (minMax.max - minMax.min) || 1

    return view.map((p, i) => {
      const x = padL + ((p.date - x0) / dx) * innerW
      const y = padT + (1 - (p.tvl - minMax.min) / dy) * innerH
      return { x, y, i }
    })
  }, [view, innerW, innerH, minMax.min, minMax.max, padL, padT])


const yTicks = React.useMemo(() => {
  const ticks = 5
  const out: { y: number; v: number }[] = []

  const min = 0
  const max = minMax.max
  const step = (max - min) / (ticks - 1)

  for (let i = 0; i < ticks; i++) {
    const v = min + step * i
    const y = padT + (1 - i / (ticks - 1)) * innerH
    out.push({ y, v })
  }

  return out
}, [minMax.max, innerH, padT])


const xTicks = React.useMemo(() => {
  const n = view.length
  if (n <= 1) return []
  const ticks = 6
  const out: { x: number; label: string }[] = []
  for (let i = 0; i < ticks; i++) {
    const idx = Math.round((i / (ticks - 1)) * (n - 1))
    const p = view[idx]
    if (!p) continue
    const x = pts[idx]?.x ?? 0
    const d = new Date(p.date)
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    out.push({ x, label })
  }
  return out
}, [view, pts])

  const pathD = React.useMemo(() => {
    if (!pts.length) return ''
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`
    return d
  }, [pts])



  const areaD = React.useMemo(() => {
    if (!pts.length) return ''
    const baseY = padT + innerH
    let d = `M ${pts[0].x} ${baseY} L ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`
    d += ` L ${pts[pts.length - 1].x} ${baseY} Z`
    return d
  }, [pts, innerH, padT])

  const onMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    if (!pts.length) return
    const rect = (ev.currentTarget as any).getBoundingClientRect()
    const mx = ev.clientX - rect.left
    const my = ev.clientY - rect.top

    const t = clamp((mx - padL) / (innerW || 1), 0, 1)
    const idx = Math.round(t * (pts.length - 1))
    const p = pts[idx]
    if (!p) return
    setHover({ i: idx, x: p.x, y: p.y })
  }

  const onDown = (ev: React.MouseEvent<SVGSVGElement>) => {
  if (!baseView.length) return
  setDragging(true)
  dragRef.current = { x: ev.clientX, a: win.a, b: win.b }
}

const onUp = () => {
  setDragging(false)
  dragRef.current = null
}

const onPanMove = (ev: React.MouseEvent<SVGSVGElement>) => {
  if (!dragRef.current || !baseView.length) return

  const fullN = baseView.length
  const a0 = clamp(dragRef.current.a, 0, fullN - 1)
  const b0 = clamp(dragRef.current.b, a0, fullN - 1)
  const size = b0 - a0 + 1

  const dx = ev.clientX - dragRef.current.x
  const pxPerPoint = (innerW || 1) / Math.max(1, size - 1)

  // drag right should move window left, so subtract
  const shift = Math.round(dx / pxPerPoint) * -1
  if (!shift) return

  let a = a0 + shift
  let b = b0 + shift

  if (a < 0) {
    a = 0
    b = size - 1
  }
  if (b > fullN - 1) {
    b = fullN - 1
    a = Math.max(0, b - size + 1)
  }

  setWin({ a, b })
}

const onWheel = (ev: React.WheelEvent<SVGSVGElement>) => {
  if (!baseView.length) return

  ev.preventDefault()
  ev.stopPropagation()
  ;(ev.nativeEvent as any).stopImmediatePropagation?.()

  const fullN = baseView.length
  const a0 = clamp(win.a, 0, fullN - 1)
  const b0 = clamp(win.b, a0, fullN - 1)
  const size0 = b0 - a0 + 1

  // center zoom around hover point (relative to current view)
  const centerInView = hover ? hover.i : Math.floor(view.length / 2)
  const center = clamp(a0 + centerInView, 0, fullN - 1)

  const zoomIn = ev.deltaY < 0
  const factor = zoomIn ? 0.85 : 1 / 0.85
  let nextSize = Math.round(size0 * factor)

  // keep it usable
  nextSize = clamp(nextSize, 8, fullN)

  let a = Math.round(center - nextSize / 2)
  let b = a + nextSize - 1

  if (a < 0) {
    a = 0
    b = nextSize - 1
  }
  if (b > fullN - 1) {
    b = fullN - 1
    a = Math.max(0, b - nextSize + 1)
  }

  setWin({ a, b })
}

  const onLeave = () => setHover(null)

  const hoverInfo = React.useMemo(() => {
    if (!hover || !view[hover.i]) return null
    const p = view[hover.i]
    const prev = view[Math.max(0, hover.i - 1)]
    const deltaPct =
      prev && prev.tvl ? ((p.tvl - prev.tvl) / prev.tvl) * 100 : null

    return {
      date: new Date(p.date),
      tvl: p.tvl,
      deltaPct,
    }
  }, [hover, view])

  if (!open) return null

  return (
    <div className='ink-modal-backdrop' onMouseDown={onClose}>
      <div className='ink-modal' onMouseDown={(e) => e.stopPropagation()}>
        <div className='ink-modal-head'>
          <div>
            <div className='ink-modal-title'>Ink TVL</div>
            <div className='ink-modal-sub'>Total Value Locked over time</div>
          </div>

          <button
  type='button'
  className='ink-modal-x'
  onClick={(e) => {
    e.stopPropagation()
    onClose()
  }}
  aria-label='close'
>
  ✕
</button>

        </div>

        <div className='ink-modal-controls'>
          <div className='ink-pills'>
            {(['7d', '1m', '3m', '1y', 'all'] as const).map((k) => (
              <button
                key={k}
                type='button'
                className={'ink-pill' + (range === k ? ' on' : '')}
                onClick={() => setRange(k)}
              >
                {k.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div ref={wrapRef} className='ink-chart-wrap'>
          {loading ? (
            <div className='ink-chart-loading'>Loading chart</div>
          ) : view.length === 0 ? (
            <div className='ink-chart-loading'>{err ? 'Chart unavailable' : 'No data'}</div>
          ) : (
            <div className='ink-chart-inner'>
              <svg
  width={svgW}
  height={h}
  className='ink-chart'
  onMouseDown={onDown}
  onMouseUp={onUp}
  onMouseLeave={() => {
    onLeave()
    onUp()
  }}
  onMouseMove={(e) => {
    if (dragging) onPanMove(e)
    else onMove(e)
  }}
  onWheel={onWheel}
  onWheelCapture={onWheel}
  style={{ cursor: dragging ? 'grabbing' : 'crosshair' }}
>

                <defs>
                  <linearGradient id='inkArea' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='var(--ink-accent, #a855f7)' stopOpacity='0.24' />
                    <stop offset='100%' stopColor='var(--ink-accent, #a855f7)' stopOpacity='0' />
                  </linearGradient>
                </defs>

{/* Y axis grid + labels */}
{yTicks.map((t, i) => (
  <g key={'y' + i}>
    <line
      x1={padL}
      y1={t.y}
      x2={padL + innerW}
      y2={t.y}
      stroke='var(--ink-chart-grid)'
      strokeWidth='1'
    />
    <text
      x={padL - 10}
      y={t.y + 4}
      textAnchor='end'
      fontSize={12}
      fill='var(--ink-chart-axis)'
    >
      {fmtUsdCompact(t.v)}
    </text>
  </g>
))}

{/* X axis labels */}
{xTicks.map((t, i) => (
  <text
    key={'x' + i}
    x={t.x}
    y={padT + innerH + 18}
    textAnchor='middle'
    fontSize={12}
    fill='var(--ink-chart-axis)'
  >
    {t.label}
  </text>
))}


<path d={areaD} fill='url(#inkArea)' />

                <path d={pathD} fill='none' stroke='var(--ink-accent, #a855f7)' strokeWidth='2.2' />

                {hover ? (
                  <>
                    <line
                      x1={hover.x}
                      y1={padT}
                      x2={hover.x}
                      y2={padT + innerH}
                      stroke='rgba(148,163,184,0.25)'
                      strokeWidth='1'
                    />
                    <circle cx={hover.x} cy={hover.y} r='4' fill='var(--ink-accent, #a855f7)' />
                  </>
                ) : null}
              </svg>

{hoverInfo && hover ? (
  <div
    className='ink-tooltip'
    style={{
      left:
        hover.x > svgW * 0.62
          ? Math.max(10, hover.x - 190) // place left of crosshair
          : Math.min(svgW - 180, hover.x + 14), // place right of crosshair
      top: 14,
    }}
  >
                  <div className='ink-tooltip-date'>
                    {hoverInfo.date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </div>
                  <div className='ink-tooltip-val'>{fmtUsdCompact(hoverInfo.tvl)}</div>
                  <div
                    className={
                      'ink-tooltip-delta' +
                      (hoverInfo.deltaPct == null ? '' : hoverInfo.deltaPct >= 0 ? ' pos' : ' neg')
                    }
                  >
                    {hoverInfo.deltaPct == null ? '' : (hoverInfo.deltaPct >= 0 ? '+' : '') + hoverInfo.deltaPct.toFixed(2) + '%'}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
