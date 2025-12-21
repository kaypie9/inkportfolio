import { NextResponse } from 'next/server'

const BLOCKSCOUT_BASE = 'https://explorer.inkonchain.com/api/v2'

type ActivityItem = {
  id: string
  direction: 'in' | 'out'
  tokenSymbol: string
  amount: number
  txHash: string
  timestamp: string
}

async function fetchTokenTransfers(
  address: string,
): Promise<ActivityItem[]> {
  try {
    const res = await fetch(
      `${BLOCKSCOUT_BASE}/addresses/${address}/token-transfers`,
      {
        // small cache ok, remove next: if you want absolutely live
        next: { revalidate: 20 },
      },
    )

    if (!res.ok) {
      console.error('blockscout activity error', res.status)
      return []
    }

    const data = await res.json()
    const items = Array.isArray(data.items) ? data.items : []

    const lower = address.toLowerCase()

    return items.slice(0, 30).map((item: any, idx: number) => {
      const token = item.token || {}
      const raw =
        String(item.total ?? item.value ?? item.amount ?? '0')
      const decimals = Number(token.decimals ?? 18)

      let amount = 0
      try {
        amount = Number(BigInt(raw)) / 10 ** decimals
      } catch {
        amount = 0
      }

      const from =
        item.from?.hash ||
        item.from_hash ||
        item.sender?.hash ||
        ''
      const to =
        item.to?.hash ||
        item.to_hash ||
        item.recipient?.hash ||
        ''

      const direction =
        from.toLowerCase() === lower ? 'out' : 'in'

      const ts =
        item.timestamp ||
        item.block?.timestamp ||
        item.inserted_at ||
        ''

      return {
        id: item.tx_hash || `${token.symbol || 'token'}-${idx}`,
        direction,
        tokenSymbol: String(token.symbol || 'UNKNOWN'),
        amount,
        txHash: String(item.tx_hash || ''),
        timestamp: ts,
      }
    })
  } catch (err) {
    console.error('blockscout activity fetch failed', err)
    return []
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const wallet = url.searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json(
      { error: 'wallet param is required' },
      { status: 400 },
    )
  }

  const items = await fetchTokenTransfers(wallet)

  return NextResponse.json({
    address: wallet,
    items,
  })
}
