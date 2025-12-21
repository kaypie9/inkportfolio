import { NextResponse } from 'next/server'
import { fetchNadoUsdEquity } from '@/lib/nado'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const wallet = searchParams.get('wallet') ?? ''

  if (!wallet) {
    return NextResponse.json(
      { ok: false, error: 'wallet param required' },
      { status: 400 },
    )
  }

  const balanceUsd = await fetchNadoUsdEquity(wallet)

  return NextResponse.json({
    ok: true,
    wallet,
    nadoUsd: balanceUsd,
  })
}
