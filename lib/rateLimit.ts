const mem = new Map<string, { n: number; resetAt: number }>()

export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now()
  const b = mem.get(key)

  if (!b || now >= b.resetAt) {
    mem.set(key, { n: 1, resetAt: now + windowMs })
    return true
  }

  if (b.n >= limit) return false

  b.n += 1
  mem.set(key, b)
  return true
}
