import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const toNumAny = (v: any) => {
  const n = toNum(v)
  if (n !== null) return n
  const pegged = toNum(v?.peggedUSD)
  if (pegged !== null) return pegged
  return null
}

async function fetchJson(url: string) {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const ct = res.headers.get('content-type') || ''

    let body: any = null
    if (ct.includes('application/json')) {
      body = await res.json()
    } else {
      const text = await res.text()
      body = { _nonJson: text.slice(0, 200) }
    }

    return { ok: res.ok, url, status: res.status, json: body }
  } catch (e: any) {
    return { ok: false, url, status: 0, json: null as any, error: e?.message || String(e) }
  }
}

function normalizeRows(json: any): any[] {
  if (Array.isArray(json)) return json
  if (Array.isArray(json?.chains)) return json.chains
  if (Array.isArray(json?.data)) return json.data
  return []
}

function rowName(r: any) {
  return String(r?.name ?? r?.chain ?? '').toLowerCase()
}

function pickStableTotalUsd(row: any) {
  const totalObj = row?.totalCirculatingUSD ?? row?.totalCirculatingUsd ?? row?.mcap ?? null

  if (typeof totalObj === 'number') return totalObj

  if (totalObj && typeof totalObj === 'object') {
    const peggedUsd = toNum((totalObj as any)?.peggedUSD)
    if (peggedUsd !== null) return peggedUsd

    let sum = 0
    let ok = false
    for (const k of Object.keys(totalObj)) {
      const n = toNum((totalObj as any)[k])
      if (n !== null) {
        sum += n
        ok = true
      }
    }
    return ok ? sum : null
  }

  return null
}

function pickChartTotal(row: any) {
  // sometimes rows are arrays like [timestamp, value]
  if (Array.isArray(row)) {
    for (let i = row.length - 1; i >= 0; i--) {
      const n = toNumAny(row[i])
      if (n !== null) return n
    }
    return null
  }

  return (
    toNumAny(row?.totalCirculatingUSD) ??
    toNumAny(row?.totalCirculatingUsd) ??
    toNumAny(row?.totalCirculating) ??
    toNumAny(row?.total) ??
    toNumAny(row?.mcap) ??
    toNumAny(row?.value) ??
    null
  )
}


export async function GET() {
  const chain = 'Ink'
  const chainSlug = 'ink'

  // base snapshot (mcap)
  const baseUrls = [
    'https://stablecoins.llama.fi/stablecoinchains',
    'http://stablecoins.llama.fi/stablecoinchains',
  ]

  let lastErr: any = null

  for (const baseUrl of baseUrls) {
    const base = await fetchJson(baseUrl)
    if (!base.ok) {
      lastErr = { step: 'base', url: baseUrl, status: base.status, error: (base as any).error }
      continue
    }

    const rows = normalizeRows(base.json)

    const row =
      rows.find((x) => rowName(x) === 'ink') ||
      rows.find((x) => rowName(x) === 'inkonchain') ||
      rows.find((x) => rowName(x) === 'ink on chain')

    if (!row) {
      lastErr = { step: 'base', url: baseUrl, msg: 'Ink not found', sample: rows.slice(0, 25).map(rowName) }
      continue
    }

    const totalUsd = pickStableTotalUsd(row)
    if (totalUsd === null) {
      lastErr = { step: 'base', url: baseUrl, msg: 'missing totalCirculatingUSD', keys: Object.keys(row || {}) }
      continue
    }

    // 1) USDT dominance: per-stablecoin breakdown
    let usdtDominancePct: number | null = null

    const breakdownUrls = [
      `https://stablecoins.llama.fi/stablecoins?chain=${encodeURIComponent(chain)}`,
      `https://stablecoins.llama.fi/stablecoins?chain=${encodeURIComponent(chainSlug)}`,
    ]

    for (const bu of breakdownUrls) {
      const br = await fetchJson(bu)

      if (!br.ok) continue

const arr: any[] = Array.isArray(br.json)
  ? br.json
  : Array.isArray(br.json?.peggedAssets)
  ? br.json.peggedAssets
  : Array.isArray(br.json?.stablecoins)
  ? br.json.stablecoins
  : Array.isArray(br.json?.data)
  ? br.json.data
  : []

const usdt =
  arr.find((x) => String(x?.symbol || x?.name || x?.gecko_id || '').toLowerCase() === 'usdt') ??
  arr.find((x) => String(x?.symbol || x?.name || '').toLowerCase().includes('tether')) ??
  null

const usdtChain =
  usdt?.chainCirculating?.[chain] ??
  usdt?.chainCirculating?.[chainSlug] ??
  null

const usdtUsd =
  toNumAny(usdtChain?.current?.peggedUSD) ??
  toNumAny(usdtChain?.peggedUSD) ??
  null







if (typeof usdtUsd === 'number' && totalUsd > 0) {
  // sanity: USDT on this chain can’t exceed total stablecoins on this chain
  if (usdtUsd <= totalUsd * 1.2) {
    usdtDominancePct = (usdtUsd / totalUsd) * 100
  }
}

      break
    }

    // 2) 7d change: history endpoint
    let change7dPct: number | null = null

    const histUrls = [
`https://stablecoins.llama.fi/stablecoincharts/${encodeURIComponent(chainSlug)}`,
`https://stablecoins.llama.fi/stablecoincharts/${encodeURIComponent(chain)}`,

    ]

    for (const hu of histUrls) {
      const hist = await fetchJson(hu)

      if (!hist.ok) continue

let arr: any[] = []

if (Array.isArray(hist.json)) arr = hist.json
else if (Array.isArray(hist.json?.data)) arr = hist.json.data
else if (Array.isArray(hist.json?.peggeedAssets)) arr = hist.json.peggeedAssets
else if (Array.isArray(hist.json?.chart)) arr = hist.json.chart


      if (arr.length >= 8) {
const latest = pickChartTotal(arr[arr.length - 1])
const prev7d = pickChartTotal(arr[arr.length - 8])



        if (typeof latest === 'number' && typeof prev7d === 'number' && prev7d > 0) {
          change7dPct = ((latest - prev7d) / prev7d) * 100
          break
        }
      }
    }



return NextResponse.json({
  ok: true,
  chain,
  stablecoins_mcap: totalUsd,
  change_7d_pct: change7dPct,
  usdt_dominance_pct: usdtDominancePct,
  source: baseUrl,
  ts: Date.now(),
})
  }

  return NextResponse.json(
    { ok: false, chain: 'Ink', stablecoins_mcap: null, lastErr },
    { status: 500 }
  )
}
