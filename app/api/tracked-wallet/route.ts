import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const raw = body?.wallet as string | undefined

    if (!raw || typeof raw !== 'string') {
      return NextResponse.json(
        { error: 'wallet is required' },
        { status: 400 },
      )
    }

    const wallet = raw.toLowerCase().trim()
    if (!wallet) {
      return NextResponse.json(
        { error: 'wallet is empty' },
        { status: 400 },
      )
    }

    const { error } = await supabaseAdmin
      .from('tracked_wallets')
      .upsert(
        {
          wallet_address: wallet,
          last_seen_at: new Date().toISOString(),
        },
        {
          onConflict: 'wallet_address',
        },
      )

    if (error) {
      console.error('tracked-wallet upsert error', error)
      return NextResponse.json(
        { error: 'db error' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, wallet })
  } catch (err) {
    console.error('tracked-wallet route error', err)
    return NextResponse.json(
      { error: 'internal error' },
      { status: 500 },
    )
  }
}
