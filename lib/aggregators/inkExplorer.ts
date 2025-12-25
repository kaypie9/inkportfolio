type CacheEntry = { at: number; data: any }
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<any>>()

const DEFAULT_TTL_MS = 15_000

export async function getInkExplorerRaw(
  url: string,
  opts?: { ttlMs?: number; fetchInit?: RequestInit }
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
        headers: {
          accept: 'application/json',
          'user-agent': 'ink-dashboard',
          ...(opts?.fetchInit?.headers || {}),
        },
        ...(opts?.fetchInit || {}),
      })

      const txt = await res.text()
      if (!res.ok) throw new Error(`explorer ${res.status}: ${txt.slice(0, 200)}`)

      const data = JSON.parse(txt)
      cache.set(url, { at: Date.now(), data })
      return data
    } finally {
      inflight.delete(url)
    }
  })()

  inflight.set(url, p)
  return p
}
