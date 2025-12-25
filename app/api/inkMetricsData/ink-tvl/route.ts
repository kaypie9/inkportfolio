import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

import { fetchChainTvlAnd24hChange } from './inkTvlFromChain'

export async function GET() {
  try {
    const { tvl, tvlChange24hPct } = await fetchChainTvlAnd24hChange({
      chainName: 'Ink',
      chainSlug: 'ink',
      revalidateSec: 0,
    })

    return NextResponse.json(
  {
    ok: true,
    chain: 'Ink',
    tvl,
    tvlChange24hPct,
    source: {
      chains: 'https://api.llama.fi/v2/chains',
      history: 'https://api.llama.fi/v2/historicalChainTvl/ink',
    },
    ts: Date.now(),
  },
  {
    headers: {
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  }
)
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        chain: 'Ink',
        tvl: null,
        tvlChange24hPct: null,
        error: String(e?.message ?? e),
      },
      { status: 500 }
    )
  }
}
