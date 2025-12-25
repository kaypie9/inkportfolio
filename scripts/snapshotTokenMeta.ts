import fs from 'fs'
import path from 'path'
import { Agent, setGlobalDispatcher } from 'undici'

type TokenMeta = {
  description?: string | null
  website?: string | null
  twitter?: string | null
  telegram?: string | null
}

const OUT_FILE = path.join(process.cwd(), 'app', 'data', 'tokenmeta.ts')
const API = 'https://inkypump.com/api/tokens?page=1&sortBy=mcap-high'

setGlobalDispatcher(
  new Agent({
    connect: { timeout: 45_000 },
    headersTimeout: 45_000,
    bodyTimeout: 45_000,
  })
)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function pickUrl(v: any): string | null {
  if (!v) return null
  const s = String(v).trim()
  if (!s) return null
  if (s.startsWith('http://') || s.startsWith('https://')) return s
  return null
}

async function main() {
  let r: Response | null = null
  let lastErr: any = null

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 60_000)

      r = await fetch(API, {
        headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0' },
        signal: ctrl.signal,
      })

      clearTimeout(t)

      if (!r.ok) throw new Error(`bad status ${r.status}`)
      break
    } catch (e: any) {
      lastErr = e
      await sleep(700 * attempt)
    }
  }

  if (!r) throw lastErr


  const j: any = await r.json()
const items: any[] = Array.isArray(j?.tokens) ? j.tokens.slice(0, 100) : []

  const map: Record<string, TokenMeta> = {}

  for (const t of items) {
    const address = String(t?.address ?? '').toLowerCase()
    if (!address) continue

    const description = t?.description ? String(t.description) : null

    const website =
      pickUrl(t?.website) ||
      pickUrl(t?.links?.website) ||
      pickUrl(t?.official_website) ||
      null

    const twitter =
      pickUrl(t?.twitter) ||
      pickUrl(t?.links?.twitter) ||
      (t?.twitter_handle ? `https://x.com/${String(t.twitter_handle).replace(/^@/, '')}` : null) ||
      null

    const telegram =
      pickUrl(t?.telegram) ||
      pickUrl(t?.links?.telegram) ||
      null

    if (description || website || twitter || telegram) {
      map[address] = { description, website, twitter, telegram }
    }
  }

  const lines: string[] = []
  lines.push('export type TokenMeta = {')
  lines.push('  description?: string | null')
  lines.push('  website?: string | null')
  lines.push('  twitter?: string | null')
  lines.push('  telegram?: string | null')
  lines.push('}')
  lines.push('')
  lines.push('export const TOKEN_META: Record<string, TokenMeta> = {')

  for (const [addr, meta] of Object.entries(map)) {
    const safe = JSON.stringify(meta, null, 0)
      .replace(/"([^"]+)":/g, '$1:')
      .replace(/"/g, "'")
    lines.push(`  '${addr}': ${safe},`)
  }

  lines.push('}')
  lines.push('')

  fs.writeFileSync(OUT_FILE, lines.join('\n'), 'utf8')
console.log(`saved ${Object.keys(map).length} tokens into app/data/tokenmeta.ts`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
