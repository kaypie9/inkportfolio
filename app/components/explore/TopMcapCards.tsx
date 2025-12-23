'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
ArrowTopRightOnSquareIcon,
ChartBarIcon,
TrophyIcon,
GlobeAltIcon,
PaperAirplaneIcon,
XMarkIcon,
InformationCircleIcon,
} from '@heroicons/react/24/outline'


type Row = {
  address: string
  symbol?: string
  name?: string
  icon?: string | null
  price?: number | null
  mcap?: number | null
  volume24h?: number | null
  liquidity?: number | null
  website?: string | null
  twitter?: string | null
  telegram?: string | null
  discord?: string | null
  description?: string | null
}

const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')

const fmtMoney = (n?: number | null) => {
  if (n === null || n === undefined) return '—'
  if (!Number.isFinite(n)) return '—'

  const v = Number(n)

  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}b`
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}m`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(2)}k`

  // small prices: dynamic decimals, max 5
  if (v < 1) {
    return `$${v.toFixed(5).replace(/0+$/, '').replace(/\.$/, '')}`
  }

  return `$${v.toFixed(2)}`
}

const XIcon = ({ className = '' }) => (
  <svg viewBox='0 0 24 24' className={className} fill='currentColor'>
    <path d='M18.244 2H21.76l-7.889 9.014L23.2 22h-7.4l-5.8-6.75L4.9 22H1.38l8.44-9.65L.8 2h7.6l5.24 6.2L18.244 2z' />
  </svg>
)

const TelegramIcon = ({ className = '' }) => (
  <svg viewBox='0 0 24 24' className={className} fill='currentColor'>
    <path d='M22.05 2.93 1.72 10.76c-1.38.55-1.37 1.32-.25 1.66l5.22 1.63 2 6.18c.26.72.14 1 .95 1 .62 0 .9-.28 1.26-.62l2.5-2.43 5.2 3.84c.96.53 1.65.26 1.9-.9L23.99 4.1c.36-1.46-.56-2.12-1.94-1.17z' />
  </svg>
)

const DiscordIcon = ({ className = '' }) => (
  <svg viewBox='0 0 24 24' className={className} fill='currentColor' aria-hidden='true'>
    <path d='M19.33 4.93a16.53 16.53 0 0 0-4.04-1.24.1.1 0 0 0-.11.05c-.18.33-.38.76-.52 1.1a15.4 15.4 0 0 0-4.64 0c-.14-.34-.34-.77-.52-1.1a.1.1 0 0 0-.11-.05c-1.4.24-2.75.66-4.04 1.24a.09.09 0 0 0-.04.03C2.24 9.13 1.6 13.19 1.92 17.2c0 .04.02.08.05.1 1.82 1.34 3.59 2.16 5.32 2.7a.1.1 0 0 0 .11-.03c.41-.56.77-1.16 1.08-1.8a.1.1 0 0 0-.05-.14 10.86 10.86 0 0 1-1.64-.78.1.1 0 0 1-.01-.16c.11-.08.22-.17.32-.26a.1.1 0 0 1 .1-.02c3.44 1.57 7.16 1.57 10.56 0a.1.1 0 0 1 .1.02c.1.09.21.18.32.26a.1.1 0 0 1-.01.16c-.52.3-1.07.56-1.64.78a.1.1 0 0 0-.05.14c.32.64.68 1.24 1.08 1.8a.1.1 0 0 0 .11.03c1.74-.54 3.5-1.36 5.33-2.7a.13.13 0 0 0 .05-.1c.38-4.64-.64-8.66-2.99-12.26a.08.08 0 0 0-.04-.03ZM8.42 14.74c-1.03 0-1.88-.95-1.88-2.12 0-1.17.83-2.12 1.88-2.12 1.05 0 1.9.96 1.88 2.12 0 1.17-.83 2.12-1.88 2.12Zm7.16 0c-1.03 0-1.88-.95-1.88-2.12 0-1.17.83-2.12 1.88-2.12 1.05 0 1.9.96 1.88 2.12 0 1.17-.83 2.12-1.88 2.12Z' />
  </svg>
)


const fmtPrice = (n?: number | null) => {
  if (n === null || n === undefined) return '—'
  if (!Number.isFinite(n)) return '—'

  const v = Number(n)
  if (v === 0) return '$0'

  // normal prices
  if (v >= 1) return `$${v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`
  if (v >= 0.01) return `$${v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`

  // tiny prices: show only 2 digits after first non-zero, so 0.000120717 -> 0.00012
  const s = v.toFixed(18)
  const parts = s.split('.')
  const dec = parts[1] ?? ''

  let z = 0
  while (z < dec.length && dec[z] === '0') z++

  const keep = Math.min(z + 2, dec.length)
  const out = `0.${dec.slice(0, keep)}`.replace(/0+$/, '').replace(/\.$/, '')

  return `$${out}`
}



function StatPill(props: { label: string; value: string }) {
  return (
    <div className='eco-statpill'>
  <span className='eco-statpill-label'>{props.label}</span>
  <span className='eco-statpill-value'>{props.value}</span>
</div>

  )
}

function DescTooltipPortal(props: { text: string }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const onEnter = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPos({
      left: Math.round(r.left),
      top: Math.round(r.bottom + 8),
    })
    setOpen(true)
  }

  const onLeave = () => setOpen(false)

  return (
    <>
      <span
        className='eco-descwrap'
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <InformationCircleIcon className='eco-descic' />
      </span>

      {open && pos
        ? createPortal(
            <div
              className='eco-desctip-portal'
              style={{ left: pos.left, top: pos.top }}
              onMouseEnter={() => setOpen(true)}
              onMouseLeave={onLeave}
            >
              <div className='eco-desctip-title'>Description</div>
              <div className='eco-desctip-text'>{props.text}</div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}

function TopTokenCard(props: { rank: number; row?: Row; loading?: boolean }) {
  const r = props.row

const explorerUrl = r?.address ? `https://explorer.inkonchain.com/address/${r.address}` : null
const chartUrl = r?.address ? `https://dexscreener.com/ink/${r.address}` : null

 const crown =
  props.rank === 1 ? 'Platinum' :
  props.rank === 2 ? 'Gold' :
  'Silver'


  return (
    <div
  className={[
    'eco-topcard',
    props.rank === 1 && 'eco-topcard-r1',
    props.rank === 2 && 'eco-topcard-r2',
    props.rank === 3 && 'eco-topcard-r3',
    r?.symbol === 'ANITA' && 'eco-topcard-anita',
  ].filter(Boolean).join(' ')}
>

      <div className='eco-topcard-top'>
        <div className='eco-topcard-badge'>
          <TrophyIcon className='eco-topcard-badge-ic' />
          <div className='eco-topcard-badge-txt'>
            <div className='eco-topcard-badge-title'>{crown}</div>
<div className='eco-topcard-badge-sub'>Top {props.rank} by mcap</div>
          </div>
        </div>

        <div className='eco-topcard-actions'>
          <a
            className='eco-topbtn'
            href={explorerUrl ?? undefined}
            target='_blank'
            rel='noreferrer'
            aria-disabled={!explorerUrl}
            onClick={(e) => {
              if (!explorerUrl) e.preventDefault()
            }}
            title='Open in explorer'
          >
            <ArrowTopRightOnSquareIcon className='eco-ic' />
            <span>Explorer</span>
          </a>
          <a
  className='eco-topbtn eco-topbtn-ghost'
  href={chartUrl ?? undefined}
  target='_blank'
  rel='noreferrer'
  aria-disabled={!chartUrl}
  onClick={(e) => {
    if (!chartUrl) e.preventDefault()
  }}
>
  <ChartBarIcon className='eco-ic' />
  <span>Chart</span>
</a>

        </div>
      </div>

      <div className='eco-topcard-mid'>
        <div className='eco-topcard-left'>

          <div className='eco-topcard-ident'>
<div
  className={[
    'eco-topcard-avatar',
    r?.symbol === 'ANITA' && 'eco-avatar-anita',
  ].filter(Boolean).join(' ')}
>
              {r?.icon ? (
                <img
                  src={r.icon}
                  alt=''
                  className='eco-topcard-icon'
                  loading='lazy'
                  referrerPolicy='no-referrer'
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : null}
            </div>

           <div className='eco-topcard-names'>
  <div className='eco-topcard-title-row'>
    <div className='eco-topcard-title'>
      {props.loading ? 'Loading' : (r?.symbol ?? r?.name ?? `Top #${props.rank}`)}
    </div>

{/* removed extra (name) */}

   {r?.description ? <DescTooltipPortal text={r.description} /> : null}


    <div className='eco-topcard-actions-mini'>
      {r?.website ? (
        <a href={r.website} target='_blank' rel='noreferrer' title='Website'>
          <GlobeAltIcon />
        </a>
      ) : null}
      {r?.twitter ? (
        <a href={r.twitter} target='_blank' rel='noreferrer' title='X'>
          <XIcon />
        </a>
      ) : null}
            {r?.telegram ? (
        <a href={r.telegram} target='_blank' rel='noreferrer' title='Telegram'>
          <TelegramIcon />
        </a>
      ) : null}

      {r?.discord ? (
        <a href={r.discord} target='_blank' rel='noreferrer' title='Discord'>
          <DiscordIcon />
        </a>
      ) : null}

    </div>
  </div>

  <div className='eco-topcard-address'>
    {props.loading ? 'Loading' : (r?.address ? shortAddr(r.address) : 'No data')}
  </div>
</div>


          </div>
        </div>

        <div className='eco-topcard-right'>
          <div className='eco-topcard-mcap'>
            <div className='eco-topcard-mcap-label'>Mcap</div>
            <div className='eco-topcard-mcap-value'>{fmtMoney(r?.mcap ?? null)}</div>
          </div>
        </div>
      </div>

      <div className='eco-topcard-stats'>
        <div className='eco-stat'>
          <div className='eco-stat-label'>Price</div>
          <div className='eco-stat-value'>{fmtPrice(r?.price ?? null)}</div>
        </div>

        <div className='eco-stat'>
          <div className='eco-stat-label'>Liquidity</div>
          <div className='eco-stat-value'>{fmtMoney(r?.liquidity ?? null)}</div>
        </div>

        <div className='eco-stat'>
          <div className='eco-stat-label'>Vol 24h</div>
          <div className='eco-stat-value'>{fmtMoney(r?.volume24h ?? null)}</div>
        </div>
      </div>
    </div>
  )
}

export default function TopMcapCards() {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let dead = false
    const run = async () => {
      try {
       const r = await fetch('/api/explore/top-tokens-mcap', { cache: 'no-store' })
const j = await r.json()
if (dead) return
setRows(Array.isArray(j?.rows) ? j.rows : [])


      } catch {
        if (dead) return
setRows([])
      }
    }
    run()
    return () => {
      dead = true
    }
  }, [])

  const r1 = rows?.[0]
  const r2 = rows?.[1]
  const r3 = rows?.[2]

  return (
    <div className='grid gap-4 md:grid-cols-3'>
     <TopTokenCard rank={1} row={r1} loading={rows === null} />
<TopTokenCard rank={2} row={r2} loading={rows === null} />
<TopTokenCard rank={3} row={r3} loading={rows === null} />

    </div>
  )
}
