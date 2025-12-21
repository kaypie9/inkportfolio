// app/api/snapshot/route.ts

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const walletRaw = body.wallet as string | undefined
    const netWorthRaw = body.netWorthUsd as number | undefined

    if (!walletRaw) {
      return NextResponse.json(
        { error: 'wallet is required' },
        { status: 400 },
      )
    }

    if (typeof netWorthRaw !== 'number') {
      return NextResponse.json(
        { error: 'netWorthUsd is required and must be number' },
        { status: 400 },
      )
    }

    const wallet = walletRaw.toLowerCase()
    const netWorth = Number(netWorthRaw)

    const { error } = await supabaseAdmin
      .from('wallet_networth_snapshots') // change to 'networth_snapshots' if that's your real table
      .insert({
        wallet_address: wallet,
        net_worth_usd: netWorth,
      })

    if (error) {
      console.error('snapshot insert error', error)
      return NextResponse.json(
        { error: 'db insert failed' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      wallet,
      netWorth,
    })
  } catch (err) {
    console.error('snapshot route failed', err)
    return NextResponse.json(
      { error: 'snapshot failed' },
      { status: 500 },
    )
  }
}
