'use client'

import TrackedHolders from '@/app/components/explore/TrackedHolders'
import TopMcapCards from '@/app/components/explore/TopMcapCards'

import React from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'


function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ')
}

function Card(props: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
<div className={cx('eco-card eco-cardbox relative p-5 border border-white/10 bg-white/5')}>
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
<div className='eco-empty border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60'>
      {props.text}
    </div>
  )
}


export default function ExploreDashboard() {
  return (
    <div className='space-y-4'>
      {/* grid */}
      <div className='grid gap-4 lg:grid-cols-12'>

        {/* top 3 by mcap */}
<div className='lg:col-span-12'>
  <TopMcapCards />
</div>

        {/* main table */}
<div className='lg:col-span-12'>
          <Card title='Tracked Wallets' subtitle='track wallet holdings and txns'>
<TrackedHolders />
          </Card>
        </div>


{/* bottom row */}
<div className='lg:col-span-12'>
  <Card title='Whale Watch' subtitle='simple, readable whale events'>
<div className='eco-table border border-white/10'>
      <div className='grid grid-cols-12 gap-3 px-4 py-3 text-[11px] font-semibold text-white/55'>
        <div className='col-span-4'>Event</div>
        <div className='col-span-3'>Wallet</div>
        <div className='col-span-3'>Token</div>
        <div className='col-span-2 text-right'>Impact</div>
      </div>
      <div className='h-px bg-white/10' />
      <div className='p-3'>
        <EmptyLine text='API not ready yet. This will show: whale bought, whale sold, whale moved, entered top holders.' />
      </div>
    </div>
  </Card>
</div>
      </div>
    </div>
  )
}
