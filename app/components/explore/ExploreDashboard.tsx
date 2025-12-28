'use client'

import TrackedHolders from '@/app/components/explore/TrackedHolders'
import TopMcapCards from '@/app/components/explore/TopMcapCards'
import TokensOverview from '@/app/components/explore/TokensOverview'

import React from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'


function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ')
}

function Card(props: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
<div className={cx('eco-card eco-cardbox eco-card-static relative p-5')}>
<div className='flex items-start justify-between gap-3'>


        <div>
          <div className='text-sm font-semibold text-white'>{props.title}</div>
          {props.subtitle ? <div className='text-xs text-white/55 mt-0.5'>{props.subtitle}</div> : null}
        </div>
        {props.right ? <div className='shrink-0'>{props.right}</div> : null}
      </div>
      <div className='mt-4'>{props.children}</div>
    </div>
  )
}

function EmptyLine(props: { text: string }) {
  return (
<div className='eco-empty px-4 py-3 text-sm'>
      {props.text}
    </div>
  )
}


export default function ExploreDashboard() {
  return (
    <div className='space-y-4'>
      <div className='eco-only-mobile'>
        <div className='eco-mobilehide-card'>
          <div className='eco-mobilehide-title'>Explore is desktop only</div>
          <div className='eco-mobilehide-sub'>Open on PC for tokens overview and tracked wallets</div>
        </div>
      </div>

      <div className='eco-only-desktop'>

      {/* grid */}
      <div className='grid gap-4 lg:grid-cols-12'>

        {/* top 3 by mcap */}
<div className='lg:col-span-12'>
  <TopMcapCards />
</div>

        {/* main table */}
<div className='lg:col-span-12'>
          <Card title='Tracked Wallets' subtitle='monitor selected tokens'>
<TrackedHolders />
          </Card>
        </div>


{/* bottom row */}
<div className='lg:col-span-12'>
<Card title='Tokens Overview'>
  <TokensOverview />
</Card>
</div>
      </div>
    </div>
    </div>
  )
}
