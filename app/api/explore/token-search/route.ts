import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const EXPLORER = 'https://explorer.inkonchain.com'
const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v)

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') ?? '').trim()

    if (!isAddress(q)) return NextResponse.json({ ok: true, results: [] })

    const r = await fetch(`${EXPLORER}/api/v2/tokens/${q}`, { cache: 'no-store' })
    if (!r.ok) return NextResponse.json({ ok: true, results: [] })

    const j = await r.json()

    return NextResponse.json({
      ok: true,
      results: [
        {
          id: String(j?.address ?? q).toLowerCase(),
          name: j?.name ? String(j.name) : undefined,
          symbol: j?.symbol ? String(j.symbol) : undefined,
        },
      ],
    })
  } catch {
    return NextResponse.json({ ok: true, results: [] })
  }
}

