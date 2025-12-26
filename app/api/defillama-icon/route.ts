import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function normKey(v: string) {
  return (v || '')
    .trim()
    .toLowerCase()
    .replace(/\.svg$/i, '')
    .replace(/\s+/g, '-')
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const iconParam = searchParams.get('icon') || ''
  const key = normKey(iconParam)

  if (!key) {
    return NextResponse.json({ ok: false, error: 'missing icon' }, { status: 400 })
  }

  const w = searchParams.get('w') || '48'
  const h = searchParams.get('h') || '48'

  const url = `https://icons.llamao.fi/icons/protocols/${encodeURIComponent(key)}?w=${encodeURIComponent(
    w
  )}&h=${encodeURIComponent(h)}`

  const imgRes = await fetch(url, { cache: 'no-store' })
  if (!imgRes.ok) {
    return NextResponse.json(
      { ok: false, error: 'no llama icon for ' + key },
      { status: 404 }
    )
  }

  const buf = await imgRes.arrayBuffer()
  const ct = imgRes.headers.get('content-type') || 'image/png'

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'content-type': ct,
      'cache-control': 'public, max-age=86400, immutable',
    },
  })
}
