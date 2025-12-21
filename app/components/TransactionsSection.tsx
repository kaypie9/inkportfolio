'use client'

import { useEffect, useState } from 'react'

type TxToken = {
  symbol: string
  address: string
}

type TxItem = {
  hash: string
  timestamp: number
  direction: 'in' | 'out' | 'self'
  from: string
  to: string
  otherParty: string
  valueInk: number
  gasFeeInk: number
  gasFeeUsd: number
  details: string
  hasNft: boolean
  status: string
  tokens: TxToken[]
}

type ApiResponse = {
  address: string
  page: number
  hasMore: boolean
  txs: TxItem[]
  tokens: TxToken[]
}

export function TransactionsSection({ wallet }: { wallet: string }) {
  const [page, setPage] = useState(1)
  const [txs, setTxs] = useState<TxItem[]>([])
  const [hasMore, setHasMore] = useState(false)

  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const [tokenOptions, setTokenOptions] = useState<TxToken[]>([])

  async function load(pageToLoad: number, token: string | null) {
    if (!wallet) return

    const params = new URLSearchParams()
    params.set('wallet', wallet)
    params.set('page', String(pageToLoad))
    if (token) params.set('token', token)

    const res = await fetch(`/api/transactions?${params.toString()}`)
    const data: ApiResponse = await res.json()

    // update txs
    if (pageToLoad === 1) {
      setTxs(data.txs)
    } else {
      setTxs(prev => [...prev, ...data.txs])
    }

    setHasMore(data.hasMore)
    setPage(pageToLoad)

    // IMPORTANT PART: use data.tokens as global token list
    if (Array.isArray(data.tokens)) {
      setTokenOptions(prev => {
        const map: Record<string, TxToken> = {}

        // merge old and new without duplicates
        for (const t of [...prev, ...data.tokens]) {
          if (!t.address) continue
          const addrLc = t.address.toLowerCase()
          if (!map[addrLc]) {
            map[addrLc] = {
              symbol: t.symbol,
              address: addrLc,
            }
          }
        }

        return Object.values(map)
      })
    }
  }

  // load when wallet or selectedToken changes
  useEffect(() => {
    if (!wallet) return
    load(1, selectedToken)
  }, [wallet, selectedToken])

  function handleChangeToken(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value || null
    setSelectedToken(v)
    setPage(1)
    setTxs([])
    // effect above will fetch page 1 with this token filter
  }

  function handleLoadMore() {
    if (!hasMore) return
    load(page + 1, selectedToken)
  }

  return (
    <div className='space-y-3'>
      {/* token filter select */}
      <div className='flex items-center gap-2'>
        <span className='text-sm text-neutral-400'>
          Filter by token
        </span>
        <select
          value={selectedToken ?? ''}
          onChange={handleChangeToken}
          className='rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-sm'
        >
          <option value=''>All tokens</option>
          {tokenOptions.map(t => (
            <option key={t.address} value={t.address}>
              {t.symbol || 'TOKEN'}  {shorten(t.address)}
            </option>
          ))}
        </select>
      </div>

      {/* transactions table */}
      <div className='rounded-xl border border-neutral-800 bg-neutral-950/60'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='text-neutral-500'>
              <th className='px-3 py-2 text-left'>Hash</th>
              <th className='px-3 py-2 text-left'>Time</th>
              <th className='px-3 py-2 text-left'>Direction</th>
              <th className='px-3 py-2 text-left'>Details</th>
            </tr>
          </thead>
          <tbody>
            {txs.map(tx => (
              <tr key={tx.hash} className='border-t border-neutral-900'>
                <td className='px-3 py-2 text-xs'>
                  {shorten(tx.hash)}
                </td>
                <td className='px-3 py-2 text-xs'>
                  {new Date(tx.timestamp).toLocaleString()}
                </td>
                <td className='px-3 py-2 text-xs'>
                  {tx.direction}
                </td>
                <td className='px-3 py-2 text-xs'>
                  {tx.details || 'Ink transfer'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {hasMore && (
          <div className='p-3 flex justify-center'>
            <button
              onClick={handleLoadMore}
              className='px-3 py-1 rounded-lg bg-neutral-800 text-sm'
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function shorten(x: string) {
  if (!x) return ''
  return `${x.slice(0, 6)}...${x.slice(-4)}`
}
