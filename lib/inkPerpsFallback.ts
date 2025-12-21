export type PerpsSourceResult = {
  id: string
  ok: boolean
  volume24hUsd: number | null
  error?: string
}

const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// ---------- NADO ----------
// set these when you have the real product ids
const NADO_ARCHIVE_ENDPOINT = 'https://archive.prod.nado.xyz/v1'
const NADO_GATEWAY_SYMBOLS_URL =
  'https://gateway.prod.nado.xyz/v1/query?type=symbols&product_type=perp'

async function fetchNadoPerpProductIds(): Promise<{ ids: number[]; symbols: string[] }> {
  const res = await fetch(NADO_GATEWAY_SYMBOLS_URL, { next: { revalidate: 300 } })
  if (!res.ok) return { ids: [], symbols: [] }

  const json: any = await res.json()

  const symbolsObj =
    json?.data?.symbols ??
    json?.symbols ??
    json?.result?.symbols ??
    json?.payload?.symbols ??
    json ??
    {}

  const ids: number[] = []
  const symbols: string[] = []

  for (const k of Object.keys(symbolsObj)) {
    const row = symbolsObj?.[k]
    if (row?.type !== 'perp') continue

    const pid = Number(row?.product_id)
    if (Number.isFinite(pid)) {
      ids.push(pid)
      symbols.push(String(row?.symbol || k))
    }
  }

  return { ids: Array.from(new Set(ids)), symbols }
}



async function postJson(url: string, body: any, revalidate = 60) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept-encoding': 'gzip, br, deflate',
    },
    body: JSON.stringify(body),
    next: { revalidate },
  })
  if (!res.ok) throw new Error(`http ${res.status}`)
  return res.json()
}

function sumCumulative(snapshot: any, productIds: number[]) {
  const vols: Record<string, string> = snapshot?.cumulative_volumes ?? {}
  let total = 0n
  for (const id of productIds) {
    const v = vols[String(id)] ?? '0'
    total += BigInt(v)
  }
  return total
}

function getBigMap(obj: any): Record<string, string> {
  return obj && typeof obj === 'object' ? obj : {}
}

function big(v: any) {
  try {
    return BigInt(v ?? '0')
  } catch {
    return 0n
  }
}

// assumes sizes and prices are 1e18 scaled
function sumNotionalFromSizes(latest: any, prev: any, productIds: number[]) {
  const sizesA = getBigMap(latest?.cumulative_trade_sizes)
  const sizesB = getBigMap(prev?.cumulative_trade_sizes)

  const pricesA = getBigMap(latest?.oracle_prices)
  const pricesB = getBigMap(prev?.oracle_prices)

  let totalUsd1e18 = 0n

  for (const id of productIds) {
    const k = String(id)

    const sa = big(sizesA[k])
    const sb = big(sizesB[k])
    if (sa <= sb) continue

    const sizeDelta = sa - sb

    const pa = big(pricesA[k])
    const pb = big(pricesB[k])
    const priceAvg = (pa + pb) / 2n
    if (priceAvg <= 0n) continue

    // sizeDelta 1e18, priceAvg 1e18, product 1e36
    // divide by 1e18 to get usd in 1e18
    totalUsd1e18 += (sizeDelta * priceAvg) / 1_000_000_000_000_000_000n
  }

  return totalUsd1e18
}

function usd1e18ToNumber(usd1e18: bigint) {
  const SCALE = 1_000_000_000_000_000_000n
  const whole = usd1e18 / SCALE
  const frac = usd1e18 % SCALE
  const usd = Number(whole) + Number(frac) / 1e18
  return Number.isFinite(usd) ? usd : null
}


function sumIntervalVolume(snapshot: any, productIds: number[]) {
  // try a few possible fields used by NADO snapshots
  const vols: Record<string, string> =
    snapshot?.volumes ??
    snapshot?.volume ??
    snapshot?.interval_volumes ??
    snapshot?.per_product_volumes ??
    {}

  let total = 0n
  for (const id of productIds) {
    const v = vols[String(id)] ?? '0'
    total += BigInt(v)
  }
  return total
}



async function fetchNadoPerpsVolume24hUsd(): Promise<{ usd: number | null; debug: any }> {
  // get latest + 24h ago in one call (25 hourly points)
const { ids: productIds, symbols } = await fetchNadoPerpProductIds()
if (!productIds.length) return { usd: null, debug: { reason: 'no product ids' } }


const body = {
  market_snapshots: {
interval: { count: 60, granularity: 3600 },
    product_ids: productIds,
  },
}


  const json = await postJson(NADO_ARCHIVE_ENDPOINT, body, 60)
  const snaps: any[] = Array.isArray(json?.snapshots) ? json.snapshots : []
if (snaps.length < 2) return { usd: null, debug: { reason: 'not enough snapshots', count: snaps.length } }

// snapshots are usually newest first, but we will not assume order
const normTs = (raw: number) => {
  // seconds vs ms vs ns
  if (!Number.isFinite(raw) || raw <= 0) return 0
  if (raw > 1e14) return Math.floor(raw / 1e9) // nanoseconds to seconds
  if (raw > 1e12) return Math.floor(raw / 1e3) // milliseconds to seconds
  return Math.floor(raw) // already seconds
}

const withTime = snaps
  .map((s: any) => {
    const raw =
      Number(s?.timestamp) ||
      Number(s?.time) ||
      Number(s?.ts) ||
      (typeof s?.date === 'number' ? s.date : 0)

    return { s, t: normTs(raw) }
  })

  .filter((x: any) => Number.isFinite(x.t) && x.t > 0)
  .sort((a: any, b: any) => b.t - a.t)

if (withTime.length < 2) return { usd: null, debug: { reason: 'no timestamps', count: withTime.length } }

// use last completed hour (skip current partial hour)
const latest = withTime[1]?.s ?? withTime[0].s
const latestT = withTime[1]?.t ?? withTime[0].t


// find the snapshot at or before 24h before latest
const target = latestT - 24 * 60 * 60

let prev24h = withTime[withTime.length - 1].s // fallback oldest
for (const x of withTime) {
  if (x.t <= target) {
    prev24h = x.s
    break
  }
}


const cumObj = latest?.cumulative_volumes ?? {}
const latestCumKeys = Object.keys(cumObj)

const foundCount = productIds.filter((id) => latestCumKeys.includes(String(id))).length
const missingCount = productIds.length - foundCount


// ---------- USD computation ----------

// method 1: cumulative volumes delta
const aVol = sumCumulative(latest, productIds)
const bVol = sumCumulative(prev24h, productIds)
let usdFromVolumes: number | null = null

if (aVol >= bVol) {
  const deltaVol = aVol - bVol
  const SCALE = 1_000_000_000_000_000_000n
  const whole = deltaVol / SCALE
  const frac = deltaVol % SCALE
  const usd = Number(whole) + Number(frac) / 1e18
  usdFromVolumes = Number.isFinite(usd) ? usd : null
}

// method 2: trade size × oracle price (matches NADO UI)
const usd1e18FromSizes = sumNotionalFromSizes(latest, prev24h, productIds)
const usdFromSizes = usd1e18ToNumber(usd1e18FromSizes)

// choose best
// choose best
let finalUsd = usdFromVolumes
let methodUsed = 'cumulative_volumes'

// debug numbers
const dbgUsdFromVolumes = usdFromVolumes
const dbgUsdFromSizes = usdFromSizes

if (usdFromSizes != null && usdFromSizes > 0) {
  if (finalUsd == null || usdFromSizes > finalUsd * 1.05) {
    finalUsd = usdFromSizes
    methodUsed = 'trade_sizes_x_oracle_price'
  }
}


if (finalUsd == null) {
  return {
    usd: null,
    debug: {
      reason: 'no usd computed',
      productIdsCount: productIds.length,
      foundCount,
      missingCount,
      sampleSymbols: symbols.slice(0, 10),
      method: methodUsed,
    },
  }
}

return {
  usd: finalUsd,
  debug: {
    productIdsCount: productIds.length,
    foundCount,
    missingCount,
    sampleSymbols: symbols.slice(0, 10),
    method: methodUsed,
    usdFromVolumes: dbgUsdFromVolumes,
    usdFromSizes: dbgUsdFromSizes,
  },
}
}

// ---------- registry ----------
// add more perps dexes here later
export async function fetchInkPerpsSources(): Promise<PerpsSourceResult[]> {
  const out: PerpsSourceResult[] = []

  // nado
  try {
const r = await fetchNadoPerpsVolume24hUsd()
out.push({ id: 'nado', ok: r.usd != null, volume24hUsd: r.usd, error: JSON.stringify(r.debug) })

} catch (e: any) {
    out.push({
      id: 'nado',
      ok: false,
      volume24hUsd: null,
      error: e?.message || 'nado fetch failed',
    })
  }

  return out
}

export function sumPerpsVolume24hUsd(results: PerpsSourceResult[]) {
  let sum = 0
  let okAny = false
  for (const r of results) {
    if (typeof r.volume24hUsd === 'number' && Number.isFinite(r.volume24hUsd)) {
      sum += r.volume24hUsd
      okAny = true
    }
  }
  return okAny ? sum : null
}
