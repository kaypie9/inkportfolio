import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Point = { date: number; tvl: number }

export async function GET() {
  try {
    const res = await fetch('https://api.llama.fi/v2/historicalChainTvl/Ink', { cache: 'no-store' })
    if (!res.ok) throw new Error('tvl series fetch failed')

    const arr = (await res.json()) as any[]
    const points: Point[] = Array.isArray(arr)
      ? arr
          .map((p) => ({
            date: Number(p?.date) * 1000,
            tvl: Number(p?.tvl),
          }))
          .filter((p) => Number.isFinite(p.date) && Number.isFinite(p.tvl))
      : []

    return NextResponse.json({
      ok: true,
      updatedAt: Date.now(),
      points,
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        updatedAt: Date.now(),
        points: [],
        error: String(e?.message ?? e ?? 'fetch failed'),
      },
      { status: 200 }
    )
  }
}
