import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT_DIR = path.join(process.cwd(), 'public', 'ecosystem-icons')
fs.mkdirSync(OUT_DIR, { recursive: true })

function safeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function fetchWithTimeout(url, ms) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    return await fetch(url, { signal: c.signal })
  } finally {
    clearTimeout(t)
  }
}

async function sleep(ms) {
  await new Promise(r => setTimeout(r, ms))
}

async function fetchProtocols() {
  const urls = [
    'https://api.llama.fi/protocols',
    'https://defillama.com/api/protocols',
  ]

  let lastErr = null

  for (const url of urls) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const r = await fetchWithTimeout(url, 45000)
        if (!r.ok) throw new Error(`http ${r.status}`)
        const j = await r.json()
        if (Array.isArray(j) && j.length) return j
        throw new Error('empty response')
      } catch (e) {
        lastErr = e
        await sleep(600 * attempt)
      }
    }
  }

  throw lastErr || new Error('failed to fetch protocols')
}


function isImageContentType(ct) {
  const s = String(ct || '').toLowerCase()
  return s.startsWith('image/')
}


function pickExt(contentType, url) {
  const ct = (contentType || '').toLowerCase()
  if (ct.includes('svg')) return 'svg'
  if (ct.includes('webp')) return 'webp'
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
  if (ct.includes('png')) return 'png'
  const m = String(url).toLowerCase().match(/\.(svg|png|webp|jpg|jpeg)(\?|$)/)
  if (m) return m[1] === 'jpeg' ? 'jpg' : m[1]
  return 'png'
}

async function main() {
  // import your ecosystem list directly
  const ecoPath = path.join(process.cwd(), 'app', 'data', 'ink-ecosystem.ts')
  const ecoMod = await import(pathToFileURL(ecoPath).href)
  const inkEcosystem = ecoMod.inkEcosystem || []

  const protocols = await fetchProtocols()

  // maps for fast lookup
  const bySlug = new Map()
  const byName = new Map()
  for (const p of protocols) {
    if (p?.slug) bySlug.set(String(p.slug).toLowerCase(), p)
    if (p?.name) byName.set(String(p.name).toLowerCase(), p)
  }

  let saved = 0
  let skipped = 0

  for (const item of inkEcosystem) {
const wantSlug = (item.llamaSlug || item.id || '').toLowerCase()

const inkIconUrl = `https://inkonchain.com/featured-apps/icons/${wantSlug}.webp`
const llamaIconUrl = `https://icons.llamao.fi/icons/protocols/${wantSlug}?w=512&h=512`




    const fileBase = safeName(item.id || item.name)
    // skip if icon already exists (any extension)
const exists = fs.readdirSync(OUT_DIR).some(f =>
  f === `${fileBase}.webp` ||
  f === `${fileBase}.png` ||
  f === `${fileBase}.jpg` ||
  f === `${fileBase}.svg`
)

if (exists) {
  skipped++
  continue
}

let res = null
let usedUrl = null

// 1) try Ink official icon first
try {
  res = await fetchWithTimeout(inkIconUrl, 15000)
  if (res.ok) usedUrl = inkIconUrl
} catch {}

// 2) fallback to DefiLlama
if (!usedUrl) {
  try {
    res = await fetchWithTimeout(llamaIconUrl, 15000)
    if (res.ok) usedUrl = llamaIconUrl
  } catch {}
}

if (!usedUrl || !res) {
  skipped++
  continue
}

const ct = res.headers.get('content-type') || ''
if (!isImageContentType(ct)) {
  skipped++
  continue
}

const buf = Buffer.from(await res.arrayBuffer())
if (!buf || buf.length < 200) {
  // too small, likely empty or error page
  skipped++
  continue
}

const ext = pickExt(ct, usedUrl)

fs.writeFileSync(
  path.join(OUT_DIR, `${fileBase}.${ext}`),
  buf
)

saved++
  }

  console.log(`done. saved=${saved} skipped=${skipped}`)
  console.log(`icons folder: public/ecosystem-icons`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
