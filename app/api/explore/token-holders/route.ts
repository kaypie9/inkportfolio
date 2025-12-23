import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE = process.env.INK_EXPLORER_API_BASE || 'https://explorer.inkonchain.com/api/v2'
const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v)
const toNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = String(searchParams.get('token') ?? '').trim()

    if (!isAddress(token)) return NextResponse.json({ ok: false })

    const r = await fetch(`${BASE}/tokens/${token}/holders`, { cache: 'no-store' })
    if (!r.ok) return NextResponse.json({ ok: false })

    const j = await r.json()

    const items = Array.isArray(j?.items) ? j.items : []
    const holders = items
      .map((x: any) => ({
        address: String(x?.address?.hash ?? x?.address ?? '').trim(),
        balance: toNum(x?.value ?? x?.balance ?? x?.amount) ?? 0,
      }))
      .filter((h: any) => isAddress(h.address))
      .slice(0, 50)

    const supply = toNum(j?.token?.total_supply ?? j?.total_supply ?? j?.supply) ?? null
    const holdersCount = toNum(j?.total ?? j?.holders_count ?? j?.count) ?? null

    return NextResponse.json({
      ok: true,
      supply,
      holdersCount,
      holders,
    })
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
