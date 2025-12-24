'use client'

import { useMemo, useState } from 'react'
import type { EcosystemItem } from '@/app/data/ink-ecosystem'
import {
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  GlobeAltIcon,
  StarIcon,
} from '@heroicons/react/24/outline'

const CATS: Array<EcosystemItem['category'] | 'All'> = [
  'All',
  'DeFi',
  'Bridge',
  'Explorer',
  'Infra',
  'Tools',
  'NFTs',
  'Games',
  'Wallet',
]

const XIcon = ({ className = '' }) => (
  <svg viewBox='0 0 24 24' className={className} fill='currentColor'>
    <path d='M18.244 2H21.76l-7.889 9.014L23.2 22h-7.4l-5.8-6.75L4.9 22H1.38l8.44-9.65L.8 2h7.6l5.24 6.2L18.244 2z' />
  </svg>
)

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ')
}

function IconBtn(props: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={props.href}
      target='_blank'
      rel='noreferrer'
      aria-label={props.label}
      className={cx(
  'eco-iconbtn inline-flex h-9 w-9 items-center justify-center rounded-xl',

        'bg-white/5 hover:bg-white/10',
        'border border-white/10 hover:border-white/20',
        'text-white/80 hover:text-white',
        'transition'
      )}
    >
      {props.children}
    </a>
  )
}

function Badge(props: { text: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold',
        'bg-white/6 text-white/80 border border-white/10'
      )}
    >
      {props.text}
    </span>
  )
}

export default function EcosystemGrid(props: { items: EcosystemItem[] }) {
  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    props.items.forEach((i) => {
      out[i.category] = (out[i.category] || 0) + 1
    })
    return out
  }, [props.items])
  const [cat, setCat] = useState<(typeof CATS)[number]>('All')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return props.items.filter((it) => {
      if (cat !== 'All' && it.category !== cat) return false
      if (!qq) return true
      const hay = [
        it.name,
        it.description,
        it.category,
        ...(it.tags ?? []),
        ...(it.badges ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(qq)
    })
  }, [props.items, cat, q])

  return (
  <div className='eco-scope space-y-4'>
      <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div className='flex flex-wrap gap-2'>
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={cx(
  'eco-tab h-10 rounded-2xl px-4 text-sm font-medium transition',

                c === cat
                  ? 'bg-white/10 text-white border border-white/15'
                  : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/8 border border-white/10'
              )}
            >
{c}
{c !== 'All' && counts[c] ? (
  <span className='ml-1 text-xs text-white/40'>
    ({counts[c]})
  </span>
) : null}
            </button>
          ))}
        </div>

        <div className='flex items-center gap-2'>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search apps...'
            className={cx(
  'eco-search h-9 w-full md:w-[220px] rounded-2xl px-3 text-sm outline-none',


              'bg-white/5 border border-white/10 text-white placeholder:text-white/40',
              'focus:bg-white/7 focus:border-white/20'
            )}
          />
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {filtered.map((it) => (
          <div
            key={it.id}
            className={cx(
'eco-card group relative overflow-hidden rounded-3xl p-5 min-h-[210px] flex flex-col',

              'bg-white/5 border border-white/10',
              'hover:bg-white/7 hover:border-white/20',
              'transition'
            )}
          >
            <div className='pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition'>
              <div className='absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-2xl' />
              <div className='absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-violet-500/10 blur-2xl' />
            </div>

            <div className='relative flex items-start justify-between gap-3'>
              <div className='flex items-center gap-3'>
                <div
                  className={cx('h-12 w-12 rounded-2xl', 'bg-black/30 border border-white/10')}
                />
                <div>
                  <div className='flex items-center gap-2'>
                    <h3 className='text-lg font-semibold text-white'>{it.name}</h3>
                    
                  </div>
                  <div className='text-xs text-white/50'>{it.category}</div>
                </div>
              </div>

              <div className='relative z-10 flex gap-2 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition'>
  {it.links.app ? (
    <IconBtn href={it.links.app} label='Open app'>
      <ArrowTopRightOnSquareIcon className='h-4 w-4' />
    </IconBtn>
  ) : it.links.website ? (
    <IconBtn href={it.links.website} label='Website'>
      <GlobeAltIcon className='h-4 w-4' />
    </IconBtn>
  ) : null}

 {it.links.twitter ? (
  <IconBtn href={it.links.twitter} label='X'>
    <XIcon className='h-4 w-4' />
  </IconBtn>
) : null}

</div>

            </div>

            <p className='relative mt-4 text-sm leading-relaxed text-white/70 line-clamp-3'>
              {it.description}
            </p>

<div className='relative mt-auto pt-4 flex items-center justify-between gap-3'>
{it.featured ? (
  <div className='eco-featured text-[11px] font-semibold'>
    <StarIcon className='h-3.5 w-3.5' />
    Featured
  </div>
) : (
  <div />
)}


  <div className='flex flex-wrap justify-end gap-2'>
    {(it.tags ?? []).slice(0, 3).map((t) => (
      <span
        key={t}
        className='inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium bg-black/25 text-white/70 border border-white/10'
      >
        {t}
      </span>
    ))}
  </div>
</div>



          </div>
        ))}
      </div>
    </div>
  )
}
