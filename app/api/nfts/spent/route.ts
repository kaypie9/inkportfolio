import { NextResponse } from 'next/server'

const BLOCKSCOUT_BASE = 'https://explorer.inkonchain.com/api/v2'

let cachedEthUsd = 0
let cachedEthUsdTs = 0

async function fetchEthUsd() {
  try {
    const now = Date.now()
    if (cachedEthUsd > 0 && now - cachedEthUsdTs < 60_000) {
      return cachedEthUsd
    }

    const priceRes = await fetch(
      'https://api.coinbase.com/v2/prices/ETH-USD/spot'
    )
    const priceJson = await priceRes.json()
    const ethUsd = Number(priceJson?.data?.amount || 0)

    if (ethUsd > 0) {
      cachedEthUsd = ethUsd
      cachedEthUsdTs = now
    }

    return ethUsd
  } catch (e) {
    console.error('fetchEthUsd failed', e)
    return 0
  }
}

async function fetchTotalSpent(wallet: string) {
  try {
    const walletLc = wallet.toLowerCase()

    const ttRes = await fetch(
      `${BLOCKSCOUT_BASE}/addresses/${wallet}/token-transfers?type=ERC-721`
    )
    const ttJson = await ttRes.json()

    const transfers: any[] = Array.isArray(ttJson.items)
      ? ttJson.items
      : Array.isArray(ttJson.transfers)
      ? ttJson.transfers
      : Array.isArray(ttJson)
      ? ttJson
      : []

    const perColEth: Record<string, number> = {}

    const relevantTransfers: {
      colAddr: string
      hash: string
    }[] = []

    const hashSet = new Set<string>()

    for (const tr of transfers) {
      const toAddr =
        typeof tr.to === 'string'
          ? tr.to.toLowerCase()
          : tr.to?.hash?.toLowerCase() || ''

      if (toAddr !== walletLc) continue

      const colAddr = (
        tr.token?.address_hash ||
        tr.token?.address ||
        tr.contract_address ||
        tr.token_address ||
        tr.contract?.address ||
        ''
      ).toLowerCase()

      if (!colAddr) continue

      const hash: string =
        tr.tx_hash || tr.transaction_hash || tr.hash || ''
      if (!hash) continue

      relevantTransfers.push({ colAddr, hash })
      hashSet.add(hash)
    }

    const txCache: Record<string, { from: string; value: number }> = {}

    const hashes = Array.from(hashSet)

    await Promise.all(
      hashes.map(async (hash) => {
        try {
          const txRes = await fetch(
            `${BLOCKSCOUT_BASE}/transactions/${hash}`
          )
          const full = await txRes.json()

          const from =
            typeof full.from === 'string'
              ? full.from.toLowerCase()
              : full.from?.hash?.toLowerCase() || ''

          const rawVal =
            full.value?.value != null ? full.value.value : full.value ?? 0
          const val = Number(rawVal)

          txCache[hash] = { from, value: val }
        } catch (err) {
          console.error('tx fetch failed', hash, err)
        }
      })
    )

    for (const { colAddr, hash } of relevantTransfers) {
      const info = txCache[hash]
      if (!info) continue

      if (info.from !== walletLc) continue
      if (!info.value || info.value <= 0) continue

      const eth = info.value / 1e18
      if (eth <= 0) continue

      perColEth[colAddr] = (perColEth[colAddr] || 0) + eth
    }

    const ethUsd = await fetchEthUsd()

    const perColUsd: Record<string, number> = {}
    Object.keys(perColEth).forEach((addr) => {
      perColUsd[addr] = perColEth[addr] * ethUsd
    })

    const totalSpentUsd = Object.values(perColUsd).reduce(
      (sum, v) => sum + v,
      0
    )

    return {
      totalSpentUsd,
      perCollectionSpentUsd: perColUsd,
    }
  } catch (e) {
    console.error('fetchTotalSpent crashed', e)
    return {
      totalSpentUsd: 0,
      perCollectionSpentUsd: {},
    }
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const wallet = url.searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json({ error: 'wallet missing' }, { status: 400 })
  }

  const spent = await fetchTotalSpent(wallet)

  return NextResponse.json(spent)
}
