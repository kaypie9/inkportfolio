import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const APP_URL =
  process.env.APP_BASE_URL || 'https://inkportfolio-tau.vercel.app'

async function getNetWorthUsdForWallet(wallet: string): Promise<number> {
  try {
    const url = `${APP_URL}/api/portfolio?wallet=${wallet}`
    const res = await fetch(url)

    if (!res.ok) {
      console.error('worker portfolio status', res.status)
      return 0
    }

    const data = await res.json()
    const value = data?.totalValueUsd
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    return 0
  } catch (err) {
    console.error('worker getNetWorthUsdForWallet error', err)
    return 0
  }
}

export async function POST(req: Request) {
  // 1. SECRET CHECK
  const auth = req.headers.get("x-cron-secret");
  if (auth !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401 }
    );
  }

  // -----------------------
  // 2. YOUR ORIGINAL CODE
  // -----------------------
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('tracked_wallets')
      .select('wallet_address')

    if (error) {
      console.error('worker select tracked_wallets error', error)
      return NextResponse.json(
        { error: 'db error' },
        { status: 500 },
      )
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 })
    }

    const nowIso = new Date().toISOString()
    let processed = 0

    for (const row of rows) {
      const wallet = (row as any).wallet_address as string | null
      if (!wallet) continue

      const netWorthUsd = await getNetWorthUsdForWallet(wallet)

      const { error: insertError } = await supabaseAdmin
        .from('wallet_networth_snapshots')
        .insert({
          wallet_address: wallet,
          net_worth_usd: netWorthUsd,
          taken_at: nowIso,
        })

      if (insertError) {
        console.error(
          'worker insert snapshot error',
          wallet,
          insertError,
        )
        continue
      }

      processed += 1
    }

    return NextResponse.json({ ok: true, processed })
  } catch (err) {
    console.error('worker snapshot-all error', err)
    return NextResponse.json(
      { error: 'internal worker error' },
      { status: 500 },
    )
  }
}
