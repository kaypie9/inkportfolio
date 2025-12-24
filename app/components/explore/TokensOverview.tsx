'use client'

import React, { useEffect, useMemo, useState } from 'react'

type SortKey = 'price' | 'mcap' | 'holders' | 'liquidity' | 'volume24h'

type TokenRow = {
  address: string
  name: string
  symbol: string
  price: number
  mcap: number
  holders: number | null
  liquidity: number
  volume24h: number
  logo?: string
  pairUrl?: string
  pairAddress?: string
}

let memTokens: TokenRow[] | null = null
let memAt = 0

const MEM_TTL_MS = 10 * 1000


const PAGE_SIZE = 10

const shortAddr = (a: string) => a.slice(0, 6) + '…' + a.slice(-4)

const fmtUsd = (n: number) => {
  if (!Number.isFinite(n)) return '–'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}b`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}m`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(2)}`
}

const fmtPrice = (n: number) => {
  if (!Number.isFinite(n)) return '–'
  if (n === 0) return '$0'

  if (n < 0.000001) return `$${n.toExponential(2)}`
  if (n < 0.01) return `$${n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`
  if (n < 1) return `$${n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`

  return `$${n.toFixed(2)}`
}

const fmtNum = (n: number | null) => {
  if (n === null || !Number.isFinite(n)) return '–'
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}m`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return String(n)
}

export default function TokensOverview() {
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('mcap')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
const [hideZeroLiq, setHideZeroLiq] = useState(false)
const [copied, setCopied] = useState(false)

  // fetch real data
useEffect(() => {
  let alive = true

  // don’t refetch when switching pages (same session)
  if (memTokens && Date.now() - memAt < MEM_TTL_MS) {
    setTokens(memTokens)
    setLoading(false)
    return () => {
      alive = false
    }
  }

  ;(async () => {
    try {
      setLoading(true)
      const r = await fetch('/api/explore/tokens-overview', { cache: 'no-store' })
      const j = await r.json()
      if (!alive) return

      const list = Array.isArray(j?.tokens) ? j.tokens : []
      memTokens = list
      memAt = Date.now()

      setTokens(list)
    } catch {
      if (!alive) return
      memTokens = []
      memAt = Date.now()
      setTokens([])
    } finally {
      if (alive) setLoading(false)
    }
  })()

  return () => {
    alive = false
  }
}, [])




  // reset page on controls change
 useEffect(() => {
  setPage(0)
}, [search, sortBy, sortDir, hideZeroLiq])

useEffect(() => {
  if (!copied) return
  const t = window.setTimeout(() => setCopied(false), 1200)
  return () => window.clearTimeout(t)
}, [copied])


const toggleSort = (k: SortKey) => {
  if (sortBy === k) {
    setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
  } else {
    setSortBy(k)
    setSortDir('desc')
  }
}

const sortArrow = (k: SortKey) => {
  if (sortBy !== k) return ''
  return sortDir === 'desc' ? '↓' : '↑'
}


  const filtered = useMemo(() => {
    return tokens.filter(t => {
      if (hideZeroLiq && t.liquidity === 0) return false
      if (!search) return true
      const q = search.toLowerCase()
      return (
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
      )
    })
  }, [tokens, search, hideZeroLiq])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = Number(a[sortBy] ?? 0)
      const bv = Number(b[sortBy] ?? 0)
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }, [filtered, sortBy, sortDir])

  const rows = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

return (
  <div className='relative'>
    {copied && (
      <div className='eco-copytoast'>
        contract copied
      </div>
    )}
      {/* controls */}
      <div className='flex justify-end gap-3 mb-3'>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder='Search token or address'
          className='eco-input w-56'
          onKeyDown={e => {
            if (e.key === 'Escape') setSearch('')
          }}
        />
        <button
          className={'eco-btn-sm ' + (hideZeroLiq ? 'on' : '')}
          onClick={() => setHideZeroLiq(v => !v)}
        >
          {hideZeroLiq ? 'hide zero liq' : 'show zero liq'}
        </button>
      </div>

      <div className='eco-table'>
        {/* header */}
        <div className='grid grid-cols-12 gap-3 px-4 py-3 text-[11px] font-semibold sticky top-0 z-10'>
  <div className='col-span-5'>Token</div>

  <div
    className='col-span-2 text-right cursor-pointer hover:text-white select-none'
    onClick={() => toggleSort('price')}
    role='button'
  >
    <span className='inline-flex items-center justify-end gap-2 w-full'>
      <span>Price</span>
      {sortBy === 'price' && <span className='text-white/70'>{sortArrow('price')}</span>}
    </span>
  </div>

  <div
    className='col-span-2 text-right cursor-pointer hover:text-white select-none'
    onClick={() => toggleSort('mcap')}
    role='button'
  >
    <span className='inline-flex items-center justify-end gap-2 w-full'>
      <span>Mcap</span>
      {sortBy === 'mcap' && <span className='text-white/70'>{sortArrow('mcap')}</span>}
    </span>
  </div>

  <div
    className='col-span-1 text-right cursor-pointer hover:text-white select-none'
    onClick={() => toggleSort('holders')}
    role='button'
  >
    <span className='inline-flex items-center justify-end gap-2 w-full'>
      <span>Holders</span>
      {sortBy === 'holders' && <span className='text-white/70'>{sortArrow('holders')}</span>}
    </span>
  </div>

  <div
    className='col-span-1 text-right cursor-pointer hover:text-white select-none'
    onClick={() => toggleSort('liquidity')}
    role='button'
  >
    <span className='inline-flex items-center justify-end gap-2 w-full'>
      <span>Liquidity</span>
      {sortBy === 'liquidity' && <span className='text-white/70'>{sortArrow('liquidity')}</span>}
    </span>
  </div>

  <div
    className='col-span-1 text-right cursor-pointer hover:text-white select-none'
    onClick={() => toggleSort('volume24h')}
    role='button'
  >
    <span className='inline-flex items-center justify-end gap-2 w-full'>
      <span>Vol 24h</span>
      {sortBy === 'volume24h' && <span className='text-white/70'>{sortArrow('volume24h')}</span>}
    </span>
  </div>
</div>


        <div className='h-px bg-white/10' />

        {/* body */}
        {loading ? (
          <div className='p-4 text-sm text-white/40'>Loading tokens…</div>
        ) : rows.length === 0 ? (
          <div className='p-4 text-sm text-white/40'>No tokens found</div>
        ) : (
          <div className='divide-y divide-white/10'>
            {rows.map(t => (
              <div
                key={t.address}
className='grid grid-cols-12 gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors cursor-default'
              >
<div className='col-span-5 cursor-pointer'>
                  <div className='flex items-center gap-3'>
                    {t.logo ? (
                      <img
                        src={t.logo}
                        alt=''
                        className='h-8 w-8 rounded-lg object-cover'
                      />
                    ) : (
                      <div className='h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-xs font-semibold'>
                        {t.symbol[0]}
                      </div>
                    )}

                    <div>
                     <button
  type='button'
  onClick={() => {
    const url =
      t.pairUrl
        ? t.pairUrl
        : t.pairAddress
        ? `https://dexscreener.com/ink/${t.pairAddress}`
        : `https://explorer.inkonchain.com/token/${t.address}`

    window.open(url, '_blank', 'noopener,noreferrer')
  }}
  className='font-medium hover:underline text-left'
>
  {t.name}
  <span className='ml-1 text-white/50 text-xs'>
    {t.symbol}
  </span>
</button>

                      <div
                        className='text-[11px] text-white/40 hover:text-white'
                        onClick={e => {
                          e.stopPropagation()
navigator.clipboard.writeText(t.address)
setCopied(true)
                        }}
                      >
                        {shortAddr(t.address)}
                      </div>
                    </div>
                  </div>
                </div>

<div className='col-span-2 text-right'>{fmtPrice(t.price)}</div>
                <div className='col-span-2 text-right'>{fmtUsd(t.mcap)}</div>
                <div className='col-span-1 text-right'>{fmtNum(t.holders)}</div>
                <div className='col-span-1 text-right'>{fmtUsd(t.liquidity)}</div>
                <div className='col-span-1 text-right'>{fmtUsd(t.volume24h)}</div>
              </div>
            ))}
          </div>
        )}

        {sorted.length > PAGE_SIZE && (
          <div className='flex justify-end gap-2 p-3 text-sm'>
            <button
              className='eco-btn'
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              Prev
            </button>
            <button
              className='eco-btn'
              disabled={(page + 1) * PAGE_SIZE >= sorted.length}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
