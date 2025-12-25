type CacheEntry = { at: number; data: any }
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<any>>()

const DEFAULT_TTL_MS = 15_000

export async function getDexScreenerRaw(
  url: string,
  opts?: { ttlMs?: number; fetchInit?: RequestInit },
) {
  const ttlMs = opts?.ttlMs ?? DEFAULT_TTL_MS
  const now = Date.now()

  const hit = cache.get(url)
  if (hit && now - hit.at < ttlMs) return hit.data

  const cur = inflight.get(url)
  if (cur) return cur

  const p = (async () => {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        ...(opts?.fetchInit || {}),
      })
      const data = await res.json()
      cache.set(url, { at: Date.now(), data })
      return data
    } finally {
      inflight.delete(url)
    }
  })()

  inflight.set(url, p)
  return p
}
