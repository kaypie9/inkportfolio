'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchTopHolders, fetchTokenMeta } from '@/lib/ink-explorer'
import { EyeIcon, EyeSlashIcon, XMarkIcon, ClipboardIcon, ArrowTopRightOnSquareIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline'

const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v)
const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')


const EXPLORER = 'https://explorer.inkonchain.com'

const COL_W = [130, 140, 100, 90, 100, 140, 250] as const
// [Token, Tracked wallets, Holding, Conc, Last action, Date]

const GRID_STYLE = {
  gridTemplateColumns: COL_W.map((w) => `${w}px`).join(' '),
} as const

// divider should start at column 2, not inside Token column
// px-4 = 16px padding, gap-4 = 16px gap
const DIVIDER_CUT_PX = COL_W[0] + 32


const nowMs = () => Date.now()

const pickHash = (v: any) => {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return v.hash || v.transaction_hash || v.tx_hash || v.transactionHash || ''
  return ''
}

const pickAddr = (v: any) => {
  if (!v) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') {
    return (
      v.hash ||
      v.address ||
      v.addr ||
      v.from ||
      v.to ||
      ''
    )
  }
  return ''
}

const safeNum = (v: any) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// BigInt string units -> number (ok for UI, not for huge whale precision)
const formatUnitsToNumber = (raw: string, decimals: number) => {
  try {
    const neg = raw.startsWith('-')
    const s = neg ? raw.slice(1) : raw

    const bi = BigInt(s || '0')
    const base = BigInt(10) ** BigInt(decimals)

    const whole = bi / base
    const frac = bi % base

    // keep 6 decimals max for UI
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '')
    const out = fracStr.length ? `${whole.toString()}.${fracStr}` : whole.toString()
    const n = Number(out)
    return neg ? -n : n
  } catch {
    return 0
  }
}

async function fetchTokenMetaLite(tokenId: string) {
  // still need decimals + supply from explorer
  const r = await fetch(`${EXPLORER}/api/v2/tokens/${tokenId}`)
  if (!r.ok) return null
  const j = await r.json()

  // icon from your local API (cached + fallback)
  let icon: string | null = null
  try {
    const ri = await fetch(`/api/token-icon?address=${tokenId}`)
    if (ri.ok) {
      const ji = await ri.json()
      icon = typeof ji?.iconUrl === 'string' && ji.iconUrl.length ? ji.iconUrl : null
    }
  } catch {}

  return {
    decimals: safeNum(j?.decimals) ?? 18,
    supply: safeNum(j?.total_supply) ?? null,
    icon,
  }
}


async function fetchWalletTokenBalance(wallet: string, tokenId: string, decimals: number) {
  try {
    const r = await fetch(
      `${EXPLORER}/api?module=account&action=tokenbalance&contractaddress=${tokenId}&address=${wallet}`
    )
    if (!r.ok) return 0

    const j = await r.json()
    const raw = String(j?.result ?? '0')
    return formatUnitsToNumber(raw, decimals)
  } catch {
    return 0
  }
}

async function fetchWalletTokenTransfers(wallet: string, tokenId: string) {
  try {
    const r = await fetch(
      `${EXPLORER}/api?module=account&action=tokentx&contractaddress=${tokenId}&address=${wallet}&sort=desc`
    )
    if (!r.ok) return []

    const j = await r.json()
    const items = Array.isArray(j?.result) ? j.result : []
    return items
  } catch {
    return []
  }
}




type WatchState = {
  tokens: {
  id: string
  name?: string
  symbol?: string
icon?: string | null
  hidden?: boolean


  // fetched data
  supply?: number
  holdersCount?: number
  holders?: {
    address: string
    balance: number
  }[]
}[]

  wallets: {
  address: string
  tokenId: string
  label?: string
  hidden?: boolean

  // stats
  balance?: number
  net24h?: number
  txns24h?: number
lastActionTs?: number
lastActionType?: 'in' | 'out'
last10?: {
hash: string
ts: number
type: 'in' | 'out'
amount: number
}[]

statsUpdatedAt?: number


}[]

  ui: {
    showHidden: boolean
  }
}

const STORAGE_KEY = 'ink_explore_watch_v3'
const OLD_KEY = 'ink_explore_watch_v2'

const DEFAULT_STATE: WatchState = {
  tokens: [],
  wallets: [],
  ui: { showHidden: false },
}


function loadState(): WatchState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE

    const parsed = JSON.parse(raw)

    const tokens = Array.isArray(parsed?.tokens) ? parsed.tokens : []
    const wallets = Array.isArray(parsed?.wallets) ? parsed.wallets : []

    return {
      ...DEFAULT_STATE,
      ...parsed,
      tokens: tokens.map((t: any) => ({
        id: String(t?.id ?? '').toLowerCase(),
        name: t?.name,
        symbol: t?.symbol,
        icon: typeof t?.icon === 'string' ? t.icon : null,
        hidden: !!t?.hidden,
        supply: typeof t?.supply === 'number' ? t.supply : undefined,
        holdersCount: typeof t?.holdersCount === 'number' ? t.holdersCount : undefined,
        holders: Array.isArray(t?.holders) ? t.holders : undefined,
      })),
      wallets: wallets.map((w: any) => ({
        address: String(w?.address ?? '').toLowerCase(),
        tokenId: String(w?.tokenId ?? '').toLowerCase(),
        label: w?.label,
        hidden: !!w?.hidden,

        // wipe computed stats so it refetches fresh
        balance: undefined,
        net24h: undefined,
        txns24h: undefined,
        lastActionTs: undefined,
        statsUpdatedAt: undefined,
      })),
    }
  } catch {
    return DEFAULT_STATE
  }
}


function saveState(v: WatchState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
}



export default function TrackedHolders() {
  useEffect(() => {
    try {
      localStorage.removeItem(OLD_KEY)
    } catch {}
  }, [])
const [state, setState] = useState<WatchState>(() => loadState())

const [showAddWallet, setShowAddWallet] = useState(false)
const [newWallet, setNewWallet] = useState('')

const [tokenQuery, setTokenQuery] = useState('')
const [selectedToken, setSelectedToken] = useState<{ id: string; name?: string; symbol?: string } | null>(null)

const [editWallet, setEditWallet] = useState<{ tokenId: string; address: string } | null>(null)
const [editLabel, setEditLabel] = useState('')
const [now, setNow] = useState(0)
const canPortal = typeof window !== 'undefined'
const [tokenMenu, setTokenMenu] = useState<{ tokenId: string } | null>(null)
const [walletMenu, setWalletMenu] = useState<{ tokenId: string; address: string } | null>(null)

const toggleTokenHidden = (tokenId: string) => {
  setState(prev => ({
    ...prev,
    tokens: prev.tokens.map(t =>
      t.id === tokenId ? { ...t, hidden: !t.hidden } : t
    ),
  }))
}

const toggleWalletHidden = (tokenId: string, address: string) => {
  setState(prev => ({
    ...prev,
    wallets: prev.wallets.map(w =>
      w.tokenId === tokenId && w.address === address
        ? { ...w, hidden: !w.hidden }
        : w
    ),
  }))
}

const deleteWallet = (tokenId: string, address: string) => {
  setState(prev => ({
    ...prev,
    wallets: prev.wallets.filter(w => !(w.tokenId === tokenId && w.address === address)),
  }))
}

const deleteToken = (tokenId: string) => {
  setState(prev => ({
    ...prev,
    tokens: prev.tokens.filter(t => t.id !== tokenId),
    wallets: prev.wallets.filter(w => w.tokenId !== tokenId),
  }))
}

const [txPopup, setTxPopup] = useState<{
  tokenId: string
  wallet: string
} | null>(null)

useEffect(() => {
const open = showAddWallet || !!editWallet || !!txPopup || !!tokenMenu || !!walletMenu
  if (!open) return

  const body = document.body
  const prevOverflow = body.style.overflow
  const prevPad = body.style.paddingRight

  const scrollbarW = window.innerWidth - document.documentElement.clientWidth

  body.style.overflow = 'hidden'
  if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`

  return () => {
    body.style.overflow = prevOverflow
    body.style.paddingRight = prevPad
  }
}, [showAddWallet, editWallet, txPopup, tokenMenu, walletMenu])






  useEffect(() => {
  state.tokens.forEach(async (t) => {
if (t.holders && t.holders.length > 0) return

    try {
      const data = await fetchTopHolders(t.id)
      setState((prev) => ({
        ...prev,
        tokens: prev.tokens.map((x) =>
          x.id === t.id ? { ...x, ...data } : x
        ),
      }))
    } catch {}
  })
}, [state.tokens])


useEffect(() => {
  if (state) saveState(state)
}, [state])

useEffect(() => {
  const t0 = setTimeout(() => setNow(Date.now()), 0)
  const id = setInterval(() => setNow(Date.now()), 60_000)
  return () => {
    clearTimeout(t0)
    clearInterval(id)
  }
}, [])


useEffect(() => {
  state.tokens.forEach(async (t) => {
    if (t.icon) return
    try {
      const r = await fetch(`/api/token-icon?address=${t.id}`)
      if (!r.ok) return
      const j = await r.json()
      const icon = typeof j?.iconUrl === 'string' && j.iconUrl.length ? j.iconUrl : null
      if (!icon) return

      setState(prev => ({
        ...prev,
        tokens: prev.tokens.map(x => (x.id === t.id ? { ...x, icon } : x)),
      }))
    } catch {}
  })
}, [state.tokens])



useEffect(() => {
  state.tokens.forEach(async (t) => {
    if (t.name || t.symbol) return

    const meta = await fetchTokenMeta(t.id)
    if (!meta) return

    setState(prev => ({
      ...prev,
      tokens: prev.tokens.map(x =>
        x.id === t.id
          ? { ...x, name: meta.name, symbol: meta.symbol }
          : x
      ),
    }))
  })
}, [state.tokens])


useEffect(() => {
  let dead = false

  const run = async () => {
    const wallets = state.wallets.filter(w => !w.hidden)
    if (wallets.length === 0) return

    const decMap = new Map<string, number>()

    for (const w of wallets) {
      const stale = !w.statsUpdatedAt || nowMs() - w.statsUpdatedAt > 2 * 60 * 1000
      if (!stale) continue

      const tokenId = w.tokenId.toLowerCase()

      if (!decMap.has(tokenId)) {
        const meta = await fetchTokenMetaLite(tokenId)
        decMap.set(tokenId, meta?.decimals ?? 18)

        // also store supply on the token row so Conc can use it
if (
  (meta?.supply !== null && meta?.supply !== undefined) ||
  (meta?.icon !== null && meta?.icon !== undefined)
) {
  setState(prev => ({
    ...prev,
    tokens: prev.tokens.map(t =>
      t.id.toLowerCase() === tokenId
        ? {
            ...t,
            supply:
              meta?.supply !== null && meta?.supply !== undefined
                ? (meta.supply ?? t.supply)
                : t.supply,
            icon:
              meta?.icon !== null && meta?.icon !== undefined
                ? meta.icon
                : t.icon,
          }
        : t
    ),
  }))
}

      }

      const decimals = decMap.get(tokenId) ?? 18

      const balance = await fetchWalletTokenBalance(w.address, tokenId, decimals)
const transfers = await fetchWalletTokenTransfers(w.address, tokenId)

      const last = transfers[0]

const lastTs =
  safeNum(last?.timeStamp) ? Number(last.timeStamp) * 1000 :
  safeNum(last?.timestamp) ? Number(last.timestamp) * 1000 :
  safeNum(last?.block_timestamp) ? Number(last.block_timestamp) * 1000 :
  safeNum(last?.time) ? Number(last.time) * 1000 :
  null

const me = w.address.toLowerCase()

const lastFrom = String(pickAddr(last?.from ?? last?.from_address)).toLowerCase()
const lastTo = String(pickAddr(last?.to ?? last?.to_address)).toLowerCase()

const lastType =
lastTo === me ? 'in' :
lastFrom === me ? 'out' :
undefined



const last10 = (Array.isArray(transfers) ? transfers : [])
  .slice(0, 80)
  .map((tr: any) => {
    const ts =
      safeNum(tr?.timeStamp) ? Number(tr.timeStamp) * 1000 :
      safeNum(tr?.timestamp) ? Number(tr.timestamp) * 1000 :
      safeNum(tr?.block_timestamp) ? Number(tr.block_timestamp) * 1000 :
      safeNum(tr?.time) ? Number(tr.time) * 1000 :
      0

    const from = String(pickAddr(tr?.from ?? tr?.from_address)).toLowerCase()
    const to = String(pickAddr(tr?.to ?? tr?.to_address)).toLowerCase()

    const type =
to === me ? 'in' :
from === me ? 'out' :
null

    let raw = String(tr?.value ?? tr?.total?.value ?? tr?.amount ?? '0')
    if (!raw) raw = '0'
    const amt = raw.includes('.') ? (safeNum(raw) ?? 0) : formatUnitsToNumber(raw, decimals)

    const hash = pickHash(tr?.hash ?? tr?.tx_hash ?? tr?.transactionHash ?? tr?.transaction_hash)
    if (!type || !ts || !hash) return null

return { hash, ts, type, amount: amt }
  })
  .filter(Boolean)
  .slice(0, 10) as {
    hash: string
    ts: number
type: 'in' | 'out'
    amount: number
  }[]


      const cutoff = Date.now() - 24 * 60 * 60 * 1000

      let net = 0
      let c = 0

      for (const tr of transfers) {
        const ts =
          safeNum(tr?.timestamp) ? Number(tr.timestamp) * 1000 :
          safeNum(tr?.block_timestamp) ? Number(tr.block_timestamp) * 1000 :
          safeNum(tr?.time) ? Number(tr.time) * 1000 :
          0

        if (!ts || ts < cutoff) continue


const from = String(pickAddr(tr?.from ?? tr?.from_address)).toLowerCase()
const to = String(pickAddr(tr?.to ?? tr?.to_address)).toLowerCase()


let raw = String(tr?.value ?? tr?.total?.value ?? tr?.amount ?? '0')

        if (!raw) raw = '0'

        const amt = raw.includes('.') ? (safeNum(raw) ?? 0) : formatUnitsToNumber(raw, decimals)

        if (to === w.address.toLowerCase()) net += amt
        if (from === w.address.toLowerCase()) net -= amt
        c += 1
      }

      if (dead) return

      setState(prev => ({
        ...prev,
        wallets: prev.wallets.map(x => {
          if (x.tokenId.toLowerCase() !== tokenId) return x
          if (x.address.toLowerCase() !== w.address.toLowerCase()) return x
return {
  ...x,
  balance,
  net24h: net,
  lastActionTs: lastTs ?? x.lastActionTs,
  lastActionType: lastType ?? x.lastActionType,
  last10: last10.length ? last10 : x.last10,
  statsUpdatedAt: Date.now(),
}


        }),
      }))
    }
  }

  run()

  return () => {
    dead = true
  }
}, [state.wallets])


const walletsForToken = (tokenId: string) =>
  state.wallets.filter(w => w.tokenId === tokenId && !w.hidden)

const sum = (arr: number[]) => arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)

const fmt = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—'
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}k`
  return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

const fmtSigned = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—'
  if (!Number.isFinite(n)) return '—'
  const s = n > 0 ? '+' : ''
  return `${s}${fmt(n)}`
}

const fmtDay = (ms?: number) => {
  if (!ms) return '—'
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const fmtAgo = (ms?: number, nowMs?: number) => {
  if (!ms) return ''
  const nowSafe = typeof nowMs === 'number' ? nowMs : 0
  if (!nowSafe) return ''
  const diff = nowSafe - ms
  if (diff < 0) return ''
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}


const copyText = async (txt: string) => {
  try {
    await navigator.clipboard.writeText(txt)
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = txt
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {}
  }
}



const fmtUsd = (n?: number | null) => {
  if (n === null || n === undefined) return '—'
  if (!Number.isFinite(n)) return '—'

  const v = Number(n)
  if (v === 0) return '$0'

  // normal prices
  if (v >= 0.01) {
    return `$${v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`
  }

  // Dexscreener-style tiny price
  const s = v.toFixed(18)
  const [, decimals = ''] = s.split('.')

  let zeroCount = 0
  for (const c of decimals) {
    if (c === '0') zeroCount++
    else break
  }

  const rest = decimals.slice(zeroCount, zeroCount + 2).replace(/0+$/, '')

  return (
  <span className='inline-flex items-baseline font-semibold'>
    <span>$0.0</span>
    <span className='mx-[1px] align-super text-[11px] leading-none opacity-70'>
      {zeroCount}
    </span>
    <span>{rest}</span>
  </span>
)

}




  const visibleTokens = state.tokens.filter(
    (t) => state.ui.showHidden || !t.hidden
  )

  return (
    <div className='space-y-3'>

<div className='flex items-center justify-between gap-2'>
<button
  onClick={() => {
    setNewWallet('')
    setTokenQuery('')
    setSelectedToken(null)
    setShowAddWallet(true)
  }}
  className='eco-btn eco-btn-primary'

>
  + Track wallet
</button>


  <button
    onClick={() =>
      setState({
        ...state,
        ui: { showHidden: !state.ui.showHidden },
      })
    }
    className='eco-btn eco-btn-ghost'

  >
    {state.ui.showHidden ? 'Hide hidden' : 'Show hidden'}
  </button>
</div>




      {/* table */}
<div className='eco-table overflow-x-auto border border-white/10 bg-white/5'>
<div className='grid gap-4 px-4 py-3 text-[11px] font-semibold text-white/55' style={GRID_STYLE}>
  <div className='min-w-0'>Token</div>
  <div className='min-w-0'>Tracked wallets</div>

  <div className='text-right'>Holding</div>
  <div className='text-right'>Conc</div>
  <div className='text-right'>Last Txn</div>
<div className='text-right'>Date</div>
<div className='text-right'>Actions</div>
</div>



<div className='h-px bg-white/10' />



        {visibleTokens.length === 0 ? (
          <div className='px-4 py-6 text-sm text-white/60'>
No tracked tokens yet. Click + Track wallet to start.
          </div>
        ) : (
<div>
  {visibleTokens.map((t, ti) => {
const ws = state.wallets.filter((w) =>
  w.tokenId === t.id && (state.ui.showHidden || !w.hidden)
)

    return (
      <div key={t.id}>
        {/* separator BETWEEN tokens */}
        {ti !== 0 && <div className='h-px bg-white/10' />}

        {/* token group grid */}
        <div className='relative grid gap-4 px-4 py-4 text-sm' style={GRID_STYLE}>
          {/* TOKEN cell spans all wallet rows, centered */}
          <div
            style={{ gridColumn: '1', gridRow: `1 / span ${Math.max(1, ws.length)}` }}
            className='flex h-full items-center'
          >
            <div className='w-full'>
              <button
  type='button'
  onClick={() => setTokenMenu({ tokenId: t.id })}
className='w-full min-w-0 text-left eco-tokenbtn'
  title='Token actions'
>
    <div className='flex items-center gap-2 min-w-0'>
  {t.icon ? (
    <img
      src={t.icon}
      alt=''
      className='h-5 w-5 rounded-md'
      loading='lazy'
      referrerPolicy='no-referrer'
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
      }}
    />
  ) : (
    <div className='h-5 w-5 rounded-md border border-white/10 bg-white/5' />
  )}

  <div className='font-semibold text-white truncate'>
    {t.symbol ?? t.name ?? shortAddr(t.id)}
  </div>
</div>


  <div className='text-xs text-white/50 truncate'>{shortAddr(t.id)}</div>
</button>
            </div>
          </div>

          {/* if no wallets */}
          {ws.length === 0 ? (
            <>
              <div style={{ gridColumn: '2', gridRow: '1' }} className='text-xs text-white/45'>
                No tracked wallets
              </div>
              <div style={{ gridColumn: '3', gridRow: '1' }} className='text-right text-xs text-white/60'>—</div>
              <div style={{ gridColumn: '4', gridRow: '1' }} className='text-right text-xs text-white/60'>—</div>
              <div style={{ gridColumn: '5', gridRow: '1' }} className='text-right text-xs text-white/60'>—</div>
              <div style={{ gridColumn: '6', gridRow: '1' }} className='text-right text-xs text-white/60'>—</div>
            </>
          ) : (
            ws.map((w, i) => {
              const supply = t.supply ?? null
              const conc =
                supply && supply > 0 && (w.balance ?? 0) > 0
                  ? ((w.balance ?? 0) / supply) * 100
                  : null

              return (
<div key={w.address} style={{ gridColumn: '2 / -1', gridRow: `${i + 1}` }} className='eco-row relative'>
                  {/* inner separator that starts AFTER token column */}
                  {i !== 0 && (
                    <div className='absolute -top-4 left-0 right-0 h-px bg-white/10' />
                  )}

                  <div className='grid gap-4 items-center' style={{ gridTemplateColumns: GRID_STYLE.gridTemplateColumns.split(' ').slice(1).join(' ') }}>
                    {/* col 2: tracked wallet */}
                    <div className='text-xs text-current'>
                      <div className='w-full min-w-0 text-left'>

  {w.label ? (
    <div className='text-[11px] font-semibold text-current leading-4 truncate'>
      {w.label}
    </div>
  ) : (
    <div className='text-[11px] font-semibold text-white/45 leading-4'>
      Set name
    </div>
  )}

  <div className='text-violet-300 font-semibold truncate'>
    {w.address.slice(0, 6)}…{w.address.slice(-4)}
  </div>
</div>

                    </div>

                    {/* col 3: holding */}
                    <div className='text-right text-xs text-current'>{fmt(w.balance ?? 0)}</div>

                    {/* col 4: conc */}
                    <div className='text-right text-xs text-current'>
                      {conc === null ? '—' : `${conc.toFixed(2)}%`}
                    </div>

                    {/* col 5: last action */}
                   <div className='text-right text-xs'>
  {w.lastActionType ? (
    <button
      type='button'
      onClick={() => setTxPopup({ tokenId: t.id, wallet: w.address })}
      className={`underline underline-offset-4 hover:opacity-90 ${
        w.lastActionType === 'in' ? 'text-emerald-400' : 'text-red-400'
      }`}
      title='Show last 10'
    >
      {w.lastActionType}
    </button>
  ) : (
    <span className='text-white/45'>—</span>
  )}
</div>



                   {/* col 6: date */}
<div className='text-right text-xs text-current'>
  <div>{fmtDay(w.lastActionTs ?? 0)}</div>
  <div className='text-[10px] opacity-70'>{fmtAgo(w.lastActionTs ?? 0, now)}</div>
</div>

{/* col 7: actions */}
<div className='flex justify-end gap-2'>
  {/* set name */}
  <button
    title='Set name'
    onClick={() => {
      setEditWallet({ tokenId: t.id, address: w.address })
      setEditLabel(w.label ?? '')
    }}
    className='eco-iconbtn h-7 w-7'
  >
    <PencilSquareIcon className='h-4 w-4' />
  </button>

  {/* copy */}
  <button
    title='Copy address'
    onClick={() => copyText(w.address)}
    className='eco-iconbtn h-7 w-7'
  >
    <ClipboardIcon className='h-4 w-4' />
  </button>

{/* open */}
<button
  type='button'
  title='Open in explorer'
  onClick={() => window.open(`${EXPLORER}/address/${w.address}`, '_blank', 'noopener,noreferrer')}
  className='eco-iconbtn h-7 w-7'
>
  <ArrowTopRightOnSquareIcon className='h-4 w-4' />
</button>


{/* hide */}
<button
  title={w.hidden ? 'Unhide' : 'Hide'}
  onClick={() => toggleWalletHidden(t.id, w.address)}
  className='eco-iconbtn h-7 w-7'
>
  {w.hidden ? (
    <EyeSlashIcon className='h-4 w-4' />
  ) : (
    <EyeIcon className='h-4 w-4' />
  )}
</button>


  {/* delete */}
  <button
    title='Delete'
    onClick={() => deleteWallet(t.id, w.address)}
    className='eco-iconbtn h-7 w-7 text-red-300 hover:text-red-200'
  >
    <TrashIcon className='h-4 w-4' />
  </button>
</div>


                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  })}
</div>

        )}
      </div>
{showAddWallet && canPortal
  ? createPortal(
<div
  className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4'
  onClick={() => setShowAddWallet(false)}
>
<div
  className='eco-modal w-full max-w-md p-5'
  onClick={(e) => e.stopPropagation()}
>
      <div className='flex items-center justify-between'>
        <div className='text-sm font-semibold text-white'>Track wallet</div>
        <button
          onClick={() => setShowAddWallet(false)}
          className='eco-iconbtn h-8 w-8'
        >
          <XMarkIcon className='h-4 w-4' />
        </button>
      </div>

<div className='mt-4 space-y-3'>

<input
  value={newWallet}
  onChange={(e) => setNewWallet(e.target.value)}
  placeholder='Wallet address (0x...)'
  className='eco-search h-9 w-full rounded-2xl px-3 text-sm bg-white/5 border border-white/10 text-white'
/>

<input
  value={tokenQuery}
  onChange={(e) => {
    const v = e.target.value
    setTokenQuery(v)

    const q = v.trim()
    if (isAddress(q)) {
      setSelectedToken({ id: q.toLowerCase() })
    } else {
      setSelectedToken(null)
    }
  }}
  placeholder='Token contract (0x...)'
  className='eco-search h-9 w-full rounded-2xl px-3 text-sm bg-white/5 border border-white/10 text-white'
/>

{selectedToken ? (
  <div className='rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80'>
    Selected: {selectedToken.id}
  </div>
) : null}

      </div>

      <div className='mt-5 flex justify-end gap-2'>
        <button
          onClick={() => setShowAddWallet(false)}
          className='eco-btn eco-btn-ghost'

        >
          Cancel
        </button>

        <button
onClick={() => {
  if (!selectedToken) return

  const walletAddr = newWallet.trim().toLowerCase()
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddr)) return

  setState(prev => {
    const tokenId = selectedToken.id.toLowerCase()

    const hasToken = prev.tokens.some(t => t.id === tokenId)
    const hasWallet = prev.wallets.some(
      w => w.tokenId === tokenId && w.address === walletAddr
    )


    
return {
  ...prev,
tokens: hasToken
  ? prev.tokens
  : [...prev.tokens, {
      id: tokenId,
      name: undefined,
      symbol: undefined,
    }],

wallets: hasWallet
  ? prev.wallets
  : [...prev.wallets, {
      address: walletAddr,
      tokenId,
label: undefined
    }]

}

  })

  setNewWallet('')
  setTokenQuery('')
  setSelectedToken(null)
  setShowAddWallet(false)
}}


          className='eco-tab h-9 px-4 rounded-2xl bg-violet-500/20 border-violet-400/30 text-violet-200'
        >
          Save
        </button>
      </div>
    </div>
    </div>,
  document.body
)
: null}


{editWallet && canPortal
  ? createPortal(
<div
  className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4'
  onClick={() => setEditWallet(null)}
>
<div
  className='eco-modal w-full max-w-md p-5'
  onClick={(e) => e.stopPropagation()}
>
      <div className='flex items-center justify-between'>
        <div className='text-sm font-semibold text-white'>Wallet name</div>
        <button
          onClick={() => setEditWallet(null)}
          className='eco-iconbtn h-8 w-8'
        >
          <XMarkIcon className='h-4 w-4' />
        </button>
      </div>

      <div className='mt-4 space-y-3'>
        <input
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          placeholder='Example: Main wallet'
          className='eco-search h-9 w-full rounded-2xl px-3 text-sm bg-white/5 border border-white/10 text-white'
        />

        <div className='text-xs text-white/50'>
          {editWallet.address.slice(0, 6)}…{editWallet.address.slice(-4)}
        </div>
      </div>

      <div className='mt-5 flex justify-end gap-2'>
        <button
          onClick={() => setEditWallet(null)}
          className='eco-btn eco-btn-ghost'

        >
          Cancel
        </button>

        <button
          onClick={() => {
            const trimmed = editLabel.trim()

            setState(prev => ({
              ...prev,
              wallets: prev.wallets.map(w =>
                w.tokenId === editWallet.tokenId && w.address === editWallet.address
                  ? { ...w, label: trimmed.length ? trimmed : undefined }
                  : w
              ),
            }))

            setEditWallet(null)
            setEditLabel('')
          }}
          className='eco-tab h-9 px-4 rounded-2xl bg-violet-500/20 border-violet-400/30 text-violet-200'
        >
          Save
        </button>
      </div>
    </div>
    </div>,
  document.body
)
: null}


{canPortal && txPopup
  ? createPortal(
<div
  className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4'
  onClick={() => setTxPopup(null)}
>

<div
className='eco-modal w-full max-w-3xl p-5'
  onClick={(e) => e.stopPropagation()}
>
      <div className='flex items-center justify-between gap-3'>
        <div className='text-sm font-semibold text-white'>Last 10 Txns</div>
        <button
          onClick={() => setTxPopup(null)}
          className='eco-iconbtn h-8 w-8'
          aria-label='Close'
        >
          <XMarkIcon className='h-4 w-4' />
        </button>
      </div>

      {(() => {
        const w = state.wallets.find(
          (x) => x.tokenId === txPopup.tokenId && x.address === txPopup.wallet
        )
        const rows = w?.last10 ?? []

        if (!rows.length) {
          return <div className='mt-4 text-sm text-white/60'>No recent tx found</div>
        }

return (
  <div className='mt-4'>

<div className='grid grid-cols-[120px,80px,1fr,60px] gap-3 px-3 pb-2 text-[11px] font-semibold text-white/45'>
  <div>Date</div>
  <div>Type</div>
  <div className='text-right'>Amount</div>
  <div className='text-right'>Txn</div>
</div>


    <div className='space-y-2'>
{rows.map((r, i) => (
        <div
key={`${r.hash}-${r.ts}-${i}`}
  className={`grid grid-cols-[120px,80px,1fr,60px] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs ${
    r.type === 'in'
      ? 'text-emerald-400'
      : 'text-red-400'
  }`}
>

          <div className='text-current'>{fmtDay(r.ts)}</div>
          <div className='font-semibold uppercase'>{r.type}</div>
<div className='text-right text-current'>{fmt(r.amount)}</div>
<div className='text-right'>

            <a
              className='text-violet-300 hover:text-violet-200'
              target='_blank'
              rel='noreferrer'
              href={`${EXPLORER}/tx/${r.hash}`}
            >
              view
            </a>
          </div>
        </div>
      ))}
        </div>
  </div>
)
      })()}
    </div>
       </div>,
      document.body
    )
  : null}

{canPortal && tokenMenu
  ? createPortal(
      <div
        className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4'
        onClick={() => setTokenMenu(null)}
      >
        <div
className='eco-popup w-full max-w-[340px] p-4'
       onClick={(e) => e.stopPropagation()}
        >
          <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0'>
              <div className='text-sm font-semibold text-white'>Token actions</div>
              <div className='mt-1 text-xs text-white/50 truncate'>{shortAddr(tokenMenu.tokenId)}</div>
            </div>

            <button
              onClick={() => setTokenMenu(null)}
              className='eco-iconbtn h-8 w-8'
              aria-label='Close'
            >
              <XMarkIcon className='h-4 w-4' />
            </button>
          </div>

          <div className='eco-popupmenu mt-3 p-1'>
  <button
    type='button'
    onClick={() => {
      copyText(tokenMenu.tokenId)
      setTokenMenu(null)
    }}
    className='flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-white/80 hover:bg-white/5 hover:text-white transition'
  >
    <span className='grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60'>
      <ClipboardIcon className='h-4 w-4' />
    </span>
    <span className='flex-1'>Copy contract</span>
  </button>

  <a
    href={`${EXPLORER}/token/${tokenMenu.tokenId}`}
    target='_blank'
    rel='noreferrer'
    onClick={() => setTokenMenu(null)}
    className='flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-white/80 hover:bg-white/5 hover:text-white transition'
  >
    <span className='grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60'>
      <ArrowTopRightOnSquareIcon className='h-4 w-4' />
    </span>
    <span className='flex-1'>Open</span>
  </a>

  <button
    type='button'
    onClick={() => {
  toggleTokenHidden(tokenMenu.tokenId)
}}

    className='flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-white/80 hover:bg-white/5 hover:text-white transition'
  >
    <span className='grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60'>
{state.tokens.find(t => t.id === tokenMenu.tokenId)?.hidden ? (
  <span className='text-[11px] font-bold'>✓</span>
) : (
  <EyeSlashIcon className='h-4 w-4' />
)}
    </span>
<span className='flex-1'>
  {state.tokens.find(t => t.id === tokenMenu.tokenId)?.hidden ? 'Hidden' : 'Hide'}
</span>
  </button>

  <button
    type='button'
    onClick={() => {
      deleteToken(tokenMenu.tokenId)
      setTokenMenu(null)
    }}
    className='mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-red-200 hover:bg-red-500/10 transition'
  >
    <span className='grid h-7 w-7 place-items-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-200'>
      <TrashIcon className='h-4 w-4' />
    </span>
    <span className='flex-1'>Delete</span>
  </button>
</div>

        </div>
      </div>,
      document.body
    )
  : null}
    </div>
  )
}
