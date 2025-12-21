// lib/buildInkProtocolRankings.ts

const CHAIN = 'Ink'
const CHAIN_SLUG = 'ink'

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const norm = (s: any) => String(s ?? '').trim().toLowerCase()

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length)
  let i = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++
      if (idx >= items.length) return
      out[idx] = await fn(items[idx])
    }
  })

  await Promise.all(workers)
  return out
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`fetch failed ${res.status} ${url}`)
  return res.json()
}

async function fetchJsonSoft(url: string) {
  try {
    return await fetchJson(url)
  } catch {
    return null
  }
}

function pickChainTvl(p: any) {
  const tvls = p?.chainTvls
  if (!tvls || typeof tvls !== 'object') return null

  const chainObj =
    tvls?.[CHAIN] ??
    tvls?.[CHAIN_SLUG] ??
    tvls?.[CHAIN.toLowerCase()] ??
    tvls?.[CHAIN_SLUG.toLowerCase()] ??
    null

  const n = toNum(chainObj?.tvl ?? chainObj)
  return n
}

function hasInkKey(p: any) {
  const tvls = p?.chainTvls
  if (!tvls || typeof tvls !== 'object') return false
  return (
    Object.prototype.hasOwnProperty.call(tvls, CHAIN) ||
    Object.prototype.hasOwnProperty.call(tvls, CHAIN_SLUG)
  )
}

function pickChangePct(p: any, key: '1d' | '7d' | '1m') {
  const raw = toNum(p?.change?.[key])
  if (raw === null) return null
  if (raw === 0) return null
  return raw * 100
}

const pct = (now: number | null, prev: number | null) => {
  if (now === null || prev === null || prev === 0) return null
  return ((now - prev) / prev) * 100
}

const pctSafe = (now: number | null, prev: number | null) => {
  const p = pct(now, prev)
  if (p === null) return null
  if (prev !== null && prev < 1000) return null
  if (Math.abs(p) > 100000) return null
  return p
}

const tvlPointVal = (x: any) =>
  toNum(x?.totalLiquidityUSD ?? x?.tvl ?? x?.totalLiquidity ?? x?.value ?? x?.usd)

function tvlSeriesFromDetail(detail: any) {
  const chainTvls = detail?.chainTvls
  const chainObj = chainTvls?.[CHAIN] ?? chainTvls?.[CHAIN_SLUG] ?? null
  const arr = chainObj?.tvl
  if (!Array.isArray(arr)) return []

  return arr
    .map((pt: any) => {
      const date = toNum(pt?.date)
      const v = tvlPointVal(pt)
      return { date, v }
    })
    .filter((pt: any) => pt.date !== null && pt.v !== null) as { date: number; v: number }[]
}

function tvlAtDaysAgo(series: { date: number; v: number }[], daysAgo: number) {
  if (!series.length) return null
  const last = series[series.length - 1]
  const target = last.date - daysAgo * 86400
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].date <= target) return series[i].v
  }
  return null
}

async function fetchTvlChangesFallback(slug: string) {
  const detail = await fetchJsonSoft(`https://api.llama.fi/protocol/${encodeURIComponent(slug)}`)
  if (!detail) return { c1: null, c7: null, c30: null }

  const s = tvlSeriesFromDetail(detail)
  const now = s.length ? s[s.length - 1].v : null

  const d1 = tvlAtDaysAgo(s, 1)
  const d7 = tvlAtDaysAgo(s, 7)
  const d30 = tvlAtDaysAgo(s, 30)

  return {
    c1: pctSafe(now, d1),
    c7: pctSafe(now, d7),
    c30: pctSafe(now, d30),
  }
}

const pickAnyNum = (obj: any, keys: string[]) => {
  for (const k of keys) {
    const n = toNum(obj?.[k])
    if (n !== null) return n
  }
  return null
}

const changeFromPrev = (cur: any, prev: any) => {
  const c = toNum(cur)
  const p = toNum(prev)
  if (c === null || p === null || p <= 0) return null
  return ((c - p) / p) * 100
}

const prevFromChangePct = (cur: any, pctVal: any) => {
  const c = toNum(cur)
  const p = toNum(pctVal)
  if (c === null || p === null) return null
  const denom = 1 + p / 100
  if (denom <= 0) return null
  return c / denom
}

async function fetchJsonSoftNoThrow(url: string) {
  try {
    const res = await fetch(url, { next: { revalidate: 600 } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function spot7dAndPrev7dFromSummaryDexSlug(dexSlug: string) {
  const raw = String(dexSlug ?? '').trim()
  if (!raw) return null

  const cleanBase = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/-v[0-9]+$/g, '')
      .replace(/-v[0-9]+-/g, '-')

  const candidates = Array.from(new Set([raw, raw.toLowerCase(), cleanBase(raw)].filter(Boolean)))

  for (const cand of candidates) {
    const j = await fetchJsonSoftNoThrow(`https://api.llama.fi/summary/dexs/${encodeURIComponent(cand)}`)
    if (!j) continue

    const breakdown = j?.totalDataChartBreakdown ?? null
    const chart = breakdown?.[CHAIN] ?? breakdown?.[CHAIN_SLUG] ?? null
    if (!Array.isArray(chart) || chart.length < 14) continue

    const last14 = chart.slice(-14)
    const vals = last14
      .map((pt: any) => toNum(pt?.[1]))
      .filter((x: any) => x !== null) as number[]

    if (vals.length < 14) continue

    const prev7 = vals.slice(0, 7).reduce((a, b) => a + b, 0)
    const cur7 = vals.slice(7, 14).reduce((a, b) => a + b, 0)

    if (prev7 <= 0) continue
    return { cur7, prev7 }
  }

  return null
}

const pctMaybe = (v: any) => {
  const n = toNum(v)
  if (n === null) return null
  if (Math.abs(n) <= 5) return n * 100
  return n
}

export async function buildInkProtocolRankings() {
  const protocols = await fetchJson('https://api.llama.fi/protocols')

  const [fees, revenue, dexs, dexAggs, bridgeAggs] = await Promise.all([
    fetchJsonSoft(`https://api.llama.fi/overview/fees/${CHAIN}`),
    fetchJsonSoft(`https://api.llama.fi/overview/revenue/${CHAIN}`),
    fetchJsonSoft(`https://api.llama.fi/overview/dexs/${CHAIN}`),
    fetchJsonSoft(`https://api.llama.fi/overview/dex-aggregators/${CHAIN}`),
    fetchJsonSoft(`https://api.llama.fi/overview/bridge-aggregators/${CHAIN}`),
  ])

  const feesBySlug = new Map<string, any>()
  const revBySlug = new Map<string, any>()
  const dexBySlug = new Map<string, any>()

  for (const r of fees?.protocols ?? []) {
    const a = String(r?.slug ?? r?.protocol ?? r?.name ?? '').trim()
    const b = String(r?.protocol ?? r?.name ?? '').trim()
    if (a) feesBySlug.set(a, r)
    if (b) feesBySlug.set(b, r)
  }

  for (const r of revenue?.protocols ?? []) {
    const a = String(r?.slug ?? r?.protocol ?? r?.name ?? '').trim()
    const b = String(r?.protocol ?? r?.name ?? '').trim()
    if (a) revBySlug.set(a, r)
    if (b) revBySlug.set(b, r)
  }

  for (const r of dexs?.protocols ?? []) {
    const a = String(r?.slug ?? r?.protocol ?? r?.name ?? '').trim()
    const b = String(r?.protocol ?? r?.name ?? '').trim()
    if (a) {
      dexBySlug.set(a, r)
      dexBySlug.set(norm(a), r)
    }
    if (b) {
      dexBySlug.set(b, r)
      dexBySlug.set(norm(b), r)
    }
  }

  const feesSet = new Set(Array.from(feesBySlug.keys()).map(norm))
  const revSet = new Set(Array.from(revBySlug.keys()).map(norm))
  const dexSet = new Set(Array.from(dexBySlug.keys()).map(norm))

  let rows = (protocols ?? [])
    .map((p: any) => {
      const slug = String(p?.slug ?? '')
      const chains = (p?.chains ?? []).map((x: any) => String(x).toLowerCase())
      const tvlInk = pickChainTvl(p)

      const slugNorm = norm(slug)
      const nameNorm = norm(p?.name)

      const fullName = String(p?.name ?? '').trim().toLowerCase()
      const fullSlug = String(slug ?? '').trim().toLowerCase()

      const listedInChains =
        chains.includes(CHAIN.toLowerCase()) || chains.includes(CHAIN_SLUG) || hasInkKey(p)

      const listedInOverviews =
        feesSet.has(slugNorm) ||
        revSet.has(slugNorm) ||
        dexSet.has(slugNorm) ||
        feesSet.has(nameNorm) ||
        revSet.has(nameNorm) ||
        dexSet.has(nameNorm) ||
        feesSet.has(fullName) ||
        revSet.has(fullName) ||
        dexSet.has(fullName) ||
        feesSet.has(fullSlug) ||
        revSet.has(fullSlug) ||
        dexSet.has(fullSlug)

      const hasInk = listedInChains || listedInOverviews
      if (!hasInk) return null

      const f = feesBySlug.get(slug) ?? null
      const rv = revBySlug.get(slug) ?? null
      const dx =
        dexBySlug.get(slug) ??
        dexBySlug.get(norm(slug)) ??
        dexBySlug.get(p?.name ?? '') ??
        dexBySlug.get(norm(p?.name)) ??
        null

      return {
        name: p?.name ?? slug,
        parts: [String(p?.name ?? slug)].filter(Boolean),
        slug,
        category: p?.category ?? null,
        logo: p?.logo ?? null,

        tvl: tvlInk ?? 0,
        change_1d_pct: pickChangePct(p, '1d'),
        change_7d_pct: pickChangePct(p, '7d'),
        change_1m_pct: pickChangePct(p, '1m'),

        fees_24h: toNum(f?.total24h),
        fees_7d: toNum(f?.total7d),
        fees_30d: toNum(f?.total30d),
        fees_1y: toNum(f?.total1y),

        revenue_24h: pickAnyNum(rv, ['revenue24h', 'total24h']),
        revenue_7d: pickAnyNum(rv, ['revenue7d', 'total7d']),
        revenue_30d: pickAnyNum(rv, ['revenue30d', 'total30d']),
        revenue_1y: pickAnyNum(rv, ['revenue1y', 'total1y']),

        cumulative_revenue: pickAnyNum(rv, [
          'totalAllTime',
          'total_all_time',
          'allTime',
          'cumulative',
          'cumulativeRevenue',
        ]),

        spot_volume_24h: toNum(dx?.total24h),
        spot_volume_7d: toNum(dx?.total7d),

        spot_prev_7d: prevFromChangePct(
          toNum(dx?.total7d),
          pctMaybe(
            pickAnyNum(dx, [
              'change_7dover7d',
              'change7dover7d',
              'change7d',
              'change_7d',
              'weeklyChange',
              'change',
            ])
          )
        ),

        spot_change_7d:
          changeFromPrev(
            toNum(dx?.total7d),
            prevFromChangePct(
              toNum(dx?.total7d),
              pctMaybe(
                pickAnyNum(dx, [
                  'change_7dover7d',
                  'change7dover7d',
                  'change7d',
                  'change_7d',
                  'weeklyChange',
                  'change',
                ])
              )
            )
          ) ??
          pctMaybe(
            pickAnyNum(dx, [
              'change_7dover7d',
              'change7dover7d',
              'change7d',
              'change_7d',
              'weeklyChange',
              'change',
            ])
          ),

        dex_sources: dx ? [String(dx?.slug ?? dx?.protocol ?? dx?.name ?? slug)] : [],
        spot_cumulative_volume:
          pickAnyNum(dx, ['totalAllTime', 'total_all_time', 'allTime', 'cumulative', 'cumulativeVolume']) ??
          pickAnyNum(dx, ['total1y', 'volume1y']) ??
          pickAnyNum(dx, ['total30d', 'volume30d']),
        spot_volume_30d: toNum(dx?.total30d),
        spot_volume_1y: toNum(dx?.total1y),
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (b.tvl ?? 0) - (a.tvl ?? 0))

  const CHANGES_CONCURRENCY = 6

  rows = await mapLimit(rows as any[], CHANGES_CONCURRENCY, async (r: any) => {
    const tvl = typeof r?.tvl === 'number' ? r.tvl : null
    if (tvl === null || tvl <= 0) return r

    if (r.change_1d_pct !== null && r.change_7d_pct !== null && r.change_1m_pct !== null) return r

    const { c1, c7, c30 } = await fetchTvlChangesFallback(String(r.slug ?? ''))

    return {
      ...r,
      change_1d_pct: r.change_1d_pct ?? c1,
      change_7d_pct: r.change_7d_pct ?? c7,
      change_1m_pct: r.change_1m_pct ?? c30,
    }
  })

  const have = new Set((rows as any[]).map((x: any) => norm(x?.slug ?? x?.name)))
  const logosByKey = new Map<string, string>()

  for (const p of protocols ?? []) {
    const slug = String(p?.slug ?? '').trim()
    const name = String(p?.name ?? '').trim()
    const logo = String(p?.logo ?? '').trim()
    if (!logo) continue

    if (slug) logosByKey.set(norm(slug), logo)
    if (name) logosByKey.set(norm(name), logo)
  }

  const pickAny = (obj: any, keys: string[]) => {
    for (const k of keys) {
      const n = toNum(obj?.[k])
      if (n !== null) return n
    }
    return null
  }

  const addFromList = (list: any, tag: string) => {
    for (const r of list?.protocols ?? []) {
      const name = String(r?.name ?? r?.protocol ?? r?.slug ?? '').trim()
      const slug = String(r?.slug ?? r?.protocol ?? '').trim()
      const key = norm(slug || name)
      if (!key || have.has(key)) continue

      ;(rows as any[]).push({
        name: name || slug || tag,
        parts: [String(name || slug || '')].filter(Boolean),
        slug: slug || key,
        category: tag,
        logo:
          logosByKey.get(norm(slug || name)) ??
          logosByKey.get(norm(name)) ??
          logosByKey.get(norm(slug)) ??
          (slug ? `https://icons.llama.fi/${encodeURIComponent(slug)}.png` : null),

        tvl: 0,
        change_1d_pct: null,
        change_7d_pct: null,
        change_1m_pct: null,

        fees_24h: null,
        fees_7d: null,
        fees_30d: null,
        fees_1y: null,

        revenue_24h: null,
        revenue_7d: null,
        revenue_30d: null,
        revenue_1y: null,
        cumulative_revenue: null,

        dex_sources: [String(slug || name || '')].filter(Boolean),

        spot_volume_24h: pickAny(r, ['total24h', 'volume24h']),
        spot_volume_7d: pickAny(r, ['total7d', 'volume7d']),

        spot_prev_7d: prevFromChangePct(
          pickAny(r, ['total7d', 'volume7d']),
          pctMaybe(
            pickAny(r, [
              'change_7dover7d',
              'change7dover7d',
              'change7d',
              'change_7d',
              'change_7d_pct',
              'change7dPct',
              'weeklyChange',
              'change',
            ])
          )
        ),

        spot_change_7d: changeFromPrev(
          pickAny(r, ['total7d', 'volume7d']),
          prevFromChangePct(
            pickAny(r, ['total7d', 'volume7d']),
            pctMaybe(
              pickAny(r, [
                'change_7dover7d',
                'change7dover7d',
                'change7d',
                'change_7d',
                'change_7d_pct',
                'change7dPct',
                'weeklyChange',
                'change',
              ])
            )
          )
        ),

        spot_cumulative_volume:
          pickAny(r, ['totalAllTime', 'total_all_time', 'allTime', 'cumulative', 'cumulativeVolume']) ??
          pickAny(r, ['total1y', 'volume1y']) ??
          pickAny(r, ['total30d', 'volume30d']),

        spot_volume_30d: pickAny(r, ['total30d', 'volume30d']),
        spot_volume_1y: pickAny(r, ['total1y', 'volume1y']),
      })

      have.add(key)
    }
  }

  addFromList(dexAggs, 'Dex Aggregator')
  addFromList(bridgeAggs, 'Bridge Aggregator')

  const baseKey = (name: any, slug: any) => {
    const raw = String(name ?? '').trim()
    const n = raw.toLowerCase()
    const s = String(slug ?? '').trim().toLowerCase()

    const clean = (x: string) => {
      let t = x.trim()

      const endings = [
        ' perps',
        ' perp',
        ' spot',
        ' swap',
        ' lending',
        ' borrow',
        ' vault',
        ' pools',
        ' pool',
        ' bridge',
        ' exchange',
        ' clmm',
        ' amm',
        ' v1',
        ' v2',
        ' v3',
        ' v4',
      ]

      for (const e of endings) {
        if (t.endsWith(e)) t = t.slice(0, -e.length).trim()
      }

      t = t.replace(/\s+/g, ' ').trim()
      return t
    }

    const a = clean(n)
    if (a) return a

    const b = clean(s.replace(/[-_]/g, ' '))
    if (b) return b

    return (n || s).toLowerCase()
  }

  const shortName = (k: string) => {
    const t = String(k ?? '').trim().toLowerCase()
    if (t.includes('securitize')) return 'Securitize'

    return t
      .split(/[\s-]+/)
      .filter(Boolean)
      .map(w => w.slice(0, 1).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const sum = (a: any, b: any) => {
    const x = toNum(a)
    const y = toNum(b)
    if (x === null && y === null) return null
    return (x ?? 0) + (y ?? 0)
  }

  const mergePct = (p1: any, w1: any, p2: any, w2: any) => {
    const a = toNum(p1)
    const b = toNum(p2)
    const wa = toNum(w1) ?? 0
    const wb = toNum(w2) ?? 0
    if (a === null && b === null) return null
    if (a !== null && b === null) return a
    if (a === null && b !== null) return b
    const denom = wa + wb
    if (denom <= 0) return a
    return ((a as number) * wa + (b as number) * wb) / denom
  }

  const merged: any[] = []
  const idx = new Map<string, number>()

  for (const r of rows as any[]) {
    const k = baseKey(r?.name, r?.slug)
    const i = idx.get(k)

    if (i === undefined) {
      idx.set(k, merged.length)
      merged.push({
        ...r,
        name: shortName(k),
        slug: k,
        parts: Array.from(new Set([...(r.parts ?? [r.name])].filter(Boolean))),
        children: [r],
      })
      continue
    }

    const cur = merged[i]
    cur.children = Array.isArray(cur.children) ? cur.children : []
    cur.children.push(r)

    cur.parts = Array.from(new Set([...(cur.parts ?? [cur.name]), ...(r.parts ?? [r.name])].filter(Boolean)))

    const tvlA = toNum(cur?.tvl) ?? 0
    const tvlB = toNum(r?.tvl) ?? 0

    cur.tvl = tvlA + tvlB

    cur.fees_24h = sum(cur.fees_24h, r.fees_24h)
    cur.fees_7d = sum(cur.fees_7d, r.fees_7d)
    cur.fees_30d = sum(cur.fees_30d, r.fees_30d)
    cur.fees_1y = sum(cur.fees_1y, r.fees_1y)

    cur.revenue_24h = sum(cur.revenue_24h, r.revenue_24h)
    cur.revenue_7d = sum(cur.revenue_7d, r.revenue_7d)
    cur.revenue_30d = sum(cur.revenue_30d, r.revenue_30d)
    cur.revenue_1y = sum(cur.revenue_1y, r.revenue_1y)

    cur.spot_volume_24h = sum(cur.spot_volume_24h, r.spot_volume_24h)
    cur.spot_volume_7d = sum(cur.spot_volume_7d, r.spot_volume_7d)
    cur.spot_prev_7d = sum(cur.spot_prev_7d, r.spot_prev_7d)
    cur.spot_change_7d = changeFromPrev(cur.spot_volume_7d, cur.spot_prev_7d)
    cur.spot_volume_30d = sum(cur.spot_volume_30d, r.spot_volume_30d)
    cur.spot_volume_1y = sum(cur.spot_volume_1y, r.spot_volume_1y)

    if (cur.spot_cumulative_volume === null) {
      cur.spot_cumulative_volume =
        (toNum(cur.spot_volume_1y) ?? null) ?? (toNum(cur.spot_volume_30d) ?? null)
    }

    cur.change_1d_pct = mergePct(cur.change_1d_pct, tvlA, r.change_1d_pct, tvlB)
    cur.change_7d_pct = mergePct(cur.change_7d_pct, tvlA, r.change_7d_pct, tvlB)
    cur.change_1m_pct = mergePct(cur.change_1m_pct, tvlA, r.change_1m_pct, tvlB)

    cur.dex_sources = Array.from(new Set([...(cur.dex_sources ?? []), ...(r.dex_sources ?? [])]))

    if (!cur.logo && r.logo) cur.logo = r.logo
    if (!cur.category && r.category) cur.category = r.category
  }

  rows = merged.sort((a: any, b: any) => (b.tvl ?? 0) - (a.tvl ?? 0))

  const CONCURRENCY = 4

  await mapLimit(rows as any[], CONCURRENCY, async (row: any) => {
    const srcs: string[] = row?.dex_sources ?? []
    if (!srcs.length) return

    let cur7Sum = 0
    let prev7Sum = 0
    let got = 0
    const partsOut: any[] = []

    for (const s of srcs) {
      let cur7: number | null = null
      let prev7: number | null = null

      const out = await spot7dAndPrev7dFromSummaryDexSlug(String(s))
      if (out) {
        cur7 = out.cur7
        prev7 = out.prev7
      } else {
        const dx = dexBySlug.get(String(s)) ?? dexBySlug.get(norm(s)) ?? null
        const c7 = toNum(dx?.total7d)
        const ch7 = toNum(
          pickAnyNum(dx, [
            'change_7dover7d',
            'change7dover7d',
            'change7d',
            'change_7d',
            'weeklyChange',
            'change',
          ])
        )

        if (c7 !== null && ch7 !== null) {
          let p7: number | null = null
          if (ch7 === -100 && c7 === 0) {
            p7 = toNum(dx?.total14dto7d) ?? toNum(dx?.total7DaysAgo) ?? null
          } else {
            p7 = prevFromChangePct(c7, ch7)
          }
          if (p7 !== null) {
            cur7 = c7
            prev7 = p7
          }
        }
      }

      if (cur7 === null || prev7 === null || prev7 <= 0) continue

      partsOut.push({
        source: String(s),
        spot_volume_7d: cur7,
        spot_prev_7d: prev7,
        spot_delta_7d: cur7 - prev7,
      })

      cur7Sum += cur7
      prev7Sum += prev7
      got++
    }

    if (!got || prev7Sum <= 0) return

    row.spot_volume_7d = cur7Sum
    row.spot_prev_7d = prev7Sum

    let pctSum = 0
    row.spot_parts = partsOut.map((p: any) => {
      const cur7 = toNum(p?.spot_volume_7d)
      const prev7 = toNum(p?.spot_prev_7d)
      if (cur7 === null || prev7 === null || prev7 <= 0) return { ...p, spot_change_7d: null }
      const pctVal = ((cur7 - prev7) / prev7) * 100
      pctSum += pctVal
      return { ...p, spot_change_7d: pctVal }
    })

    row.spot_change_7d = pctSum
  })

  return rows as any[]
}
