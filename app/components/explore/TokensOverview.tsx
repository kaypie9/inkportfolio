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

type HoldRow = { rank: number; address: string; value: any; pct: any }

const getTokCache = () => (globalThis as any).__ink_tokens_overview_cache__ as TokenRow[] | null | undefined
const setTokCache = (v: TokenRow[] | null) => {
  ;(globalThis as any).__ink_tokens_overview_cache__ = v
}

const getHoldCache = () =>
  ((globalThis as any).__ink_holders_cache__ as Map<string, HoldRow[]> | undefined) ??
  new Map<string, HoldRow[]>()

const setHoldCache = (m: Map<string, HoldRow[]>) => {
  ;(globalThis as any).__ink_holders_cache__ = m
}

const PAGE_SIZE = 25

const shortAddr = (a: string) => a.slice(0, 6) + '...' + a.slice(-4)

const fmtUsd = (n: number) => {
  if (!Number.isFinite(n)) return '–'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}b`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}m`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}k`
  return `$${n.toFixed(2)}`
}

const fmtAmountPretty = (v: any) => {
  if (v == null) return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return String(v)

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
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
const [copied, setCopied] = useState(false)

const [holdersOpen, setHoldersOpen] = useState(false)
const [holdersLoading, setHoldersLoading] = useState(false)
const [holdersErr, setHoldersErr] = useState<string | null>(null)
const [holdersToken, setHoldersToken] = useState<TokenRow | null>(null)
const [topHolders, setTopHolders] = useState<Array<{ rank: number; address: string; value: any; pct: any }>>([])

  // fetch real data
useEffect(() => {
  let alive = true

// don’t refetch when switching pages (same session)
const cached = getTokCache()
if (cached) {
  setTokens(cached)
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
      setTokCache(list)
setTokens(list)
setHoldCache(new Map())


    } catch {
      if (!alive) return
      setTokCache([])
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
}, [search, sortBy, sortDir])

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

async function openHolders(t: TokenRow) {
setHoldersToken(t)
setHoldersOpen(true)
setHoldersErr(null)
setHoldersLoading(true)


  const key = t.address.toLowerCase()
const holdCache = getHoldCache()
const cached = holdCache.get(key)

if (cached) {
  setHoldersErr(null)
  setTopHolders(cached)
  setHoldersLoading(false)
  return
}



  setHoldersLoading(true)
  setTopHolders([])

  try {
    const r = await fetch(`/api/explore/top-holders?address=${t.address}`, { cache: 'no-store' })
    const j = await r.json()
    if (!j?.ok) throw new Error(j?.error || 'failed')

    const holders = Array.isArray(j?.holders) ? j.holders : []
    setTopHolders(holders)

    // save to session cache
holdCache.set(key, holders)
setHoldCache(holdCache)
  } catch (e: any) {
    setHoldersErr(String(e?.message || e))
  } finally {
    setHoldersLoading(false)
  }
}




  const filtered = useMemo(() => {
    return tokens.filter(t => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
      )
    })
  }, [tokens, search])

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

    {holdersOpen && (
      <div className='eco-modalback' onClick={() => setHoldersOpen(false)}>
        <div className='eco-modal' onClick={e => e.stopPropagation()}>
          <div className='eco-modalhead'>
            <div>
              <div className='eco-modaltitle'>Top holders</div>
              {holdersToken ? (
                <div className='eco-modalsub'>
                  {holdersToken.symbol} • {shortAddr(holdersToken.address)}
                </div>
              ) : null}
            </div>

            <button
              type='button'
              className='eco-modalx'
              onClick={() => setHoldersOpen(false)}
            >
              ×
            </button>
          </div>

          <div className='eco-modalbody'>
            {holdersLoading ? (
  <div className='eco-holderlist'>
    {Array.from({ length: 8 }).map((_, i) => (
      <div key={i} className='eco-holderrow'>
        <div className='eco-holderrank'>
          <span className='ink-skeleton ink-skeleton-xs' />
        </div>

        <div className='eco-holderaddr'>
          <span className='ink-skeleton ink-skeleton-lg w-full' />
        </div>

        <div className='eco-holdermeta'>
          <div className='eco-holderamt'>
            <span className='ink-skeleton ink-skeleton-sm' />
          </div>
          <div className='eco-holderpct2'>
            <span className='ink-skeleton ink-skeleton-xs' />
          </div>
        </div>
      </div>
    ))}
  </div>
)

 : holdersErr ? (
              <div className='eco-modalerr text-sm'>{holdersErr}</div>
            ) : topHolders.length ? (
              <div className='eco-holderlist'>
                {topHolders.slice(0, 25).map(h => (
                  <div key={h.rank} className='eco-holderrow'>
                    <div className='eco-holderrank'>#{h.rank}</div>

                    <div
                      className='eco-holderaddr'
                      onClick={() => {
                        navigator.clipboard.writeText(h.address)
                        setCopied(true)
                      }}
                      title='Copy address'
                    >
                      {h.address}
                    </div>

                    <div className='eco-holdermeta'>
  <div className='eco-holderamt'>
{h.value != null && String(h.value) !== '' ? `${fmtAmountPretty(h.value)} ${holdersToken?.symbol || ''}` : ''}
  </div>

  <div className='eco-holderpct2'>
    {h.pct != null && Number.isFinite(Number(h.pct)) ? `${Number(h.pct).toFixed(4)}%` : ''}
  </div>
</div>


                  </div>
                ))}
              </div>
            ) : (
              <div className='text-white/50 text-sm'>No holders data</div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* controls */}
      <div className='flex items-center justify-between gap-3 mb-3'>
        <div className='text-xs text-white/50'>
          showing {rows.length} of {sorted.length}
          {sorted.length > 0 ? `  page ${page + 1} of ${Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))}` : ''}
        </div>

        <div className='flex justify-end gap-3'>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search token or address'
className='eco-input w-64'
            onKeyDown={e => {
              if (e.key === 'Escape') setSearch('')
            }}
          />
        </div>
      </div>


      <div className='eco-table'>
        {/* header */}
<div className='eco-table-head eco-tablehead grid grid-cols-12 gap-3 px-4 py-3 items-center text-[11px] font-semibold'>
  <div className='col-span-5'>Token</div>

  <div
className='col-span-2 text-right cursor-pointer eco-sort select-none'
    onClick={() => toggleSort('price')}
    role='button'
  >
    <span className='inline-flex items-center justify-end gap-2 w-full'>
      <span>Price</span>
      {sortBy === 'price' && <span className='eco-sort-arrow'>{sortArrow('price')}</span>}
    </span>
  </div>

  <div
className='col-span-2 text-right cursor-pointer eco-sort select-none'
    onClick={() => toggleSort('mcap')}
    role='button'
  >
    <span className='inline-flex items-center justify-end gap-2 w-full'>
      <span>Mcap</span>
{sortBy === 'mcap' && <span className='eco-sort-arrow'>{sortArrow('mcap')}</span>}
    </span>
  </div>

  <div
    className='col-span-1 text-center cursor-pointer eco-sort select-none'
    onClick={() => toggleSort('holders')}
    role='button'
  >
    <span className='inline-flex items-center justify-end gap-2 w-full'>
      <span>Holders</span>
{sortBy === 'holders' && <span className='eco-sort-arrow'>{sortArrow('holders')}</span>}
    </span>
  </div>

  <div
    className='col-span-1 text-center cursor-pointer eco-sort select-none'
    onClick={() => toggleSort('liquidity')}
    role='button'
  >
    <span className='inline-flex items-center justify-end gap-2 w-full'>
      <span>Liquidity</span>
{sortBy === 'liquidity' && <span className='eco-sort-arrow'>{sortArrow('liquidity')}</span>}
    </span>
  </div>

  <div
    className='col-span-1 text-center cursor-pointer eco-sort select-none'
    onClick={() => toggleSort('volume24h')}
    role='button'
  >
    <span className='inline-flex items-center justify-end gap-2 w-full'>
      <span>Vol 24h</span>
{sortBy === 'volume24h' && <span className='eco-sort-arrow'>{sortArrow('volume24h')}</span>}
    </span>
  </div>
</div>


<div className='eco-tabledivider' />

        {/* body */}
        {loading ? (
  <div className='eco-divide'>
    {Array.from({ length: 10 }).map((_, i) => (
      <div
        key={i}
        className='eco-tablerow grid grid-cols-12 gap-3 px-4 py-3 text-sm cursor-default'
      >
        <div className='col-span-5'>
          <div className='flex items-center gap-3'>
            <span className='ink-skeleton ink-skeleton-logo' />
            <div className='min-w-0'>
              <div>
                <span className='ink-skeleton ink-skeleton-lg' />
                <span className='ml-2 ink-skeleton ink-skeleton-sm' />
              </div>
              <div className='mt-2'>
                <span className='ink-skeleton ink-skeleton-sm' />
              </div>
            </div>
          </div>
        </div>

        <div className='col-span-2 text-right tabular-nums'>
          <span className='ink-skeleton ink-skeleton-sm' />
        </div>

        <div className='col-span-2 text-right tabular-nums'>
          <span className='ink-skeleton ink-skeleton-sm' />
        </div>

        <div className='col-span-1 text-center tabular-nums'>
          <span className='ink-skeleton ink-skeleton-xs' />
        </div>

        <div className='col-span-1 text-right tabular-nums'>
          <span className='ink-skeleton ink-skeleton-sm' />
        </div>

        <div className='col-span-1 text-right tabular-nums'>
          <span className='ink-skeleton ink-skeleton-sm' />
        </div>
      </div>
    ))}
  </div>
) : rows.length === 0 ? (
  <div className='p-4 text-sm eco-muted'>No tokens found</div>
) : (
  <div className='eco-divide'>

            {rows.map(t => (
              <div
                key={t.address}
className='eco-tablerow grid grid-cols-12 gap-3 px-4 py-3 text-sm transition-colors cursor-default'
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
className='eco-tokenlink text-left'
>
  {t.name}
<span className='ml-1 eco-sub text-xs'>
    {t.symbol}
  </span>
</button>

                      <div
className='text-[11px] eco-copyaddr'
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

<div className='col-span-2 text-right tabular-nums'>{fmtPrice(t.price)}</div>
<div className='col-span-2 text-right tabular-nums'>{fmtUsd(t.mcap)}</div>
<div className='col-span-1 text-center tabular-nums'>
  {t.holders ? (
    <button
      type='button'
      className='eco-holderslink'
      onClick={e => {
        e.stopPropagation()
        openHolders(t)
      }}
      title='View top holders'
    >
      {fmtNum(t.holders)}
    </button>
  ) : (
<span className='eco-muted'>{fmtNum(t.holders)}</span>
  )}
</div>
<div className='col-span-1 text-right tabular-nums'>{fmtUsd(t.liquidity)}</div>
<div className='col-span-1 text-right tabular-nums'>{fmtUsd(t.volume24h)}</div>
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
