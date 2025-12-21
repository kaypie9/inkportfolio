import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildInkProtocolRankings } from '@/lib/buildInkProtocolRankings'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KEY = 'ink-protocol-rankings'

export async function GET(req: Request) {
  try {
const secret = process.env.CRON_SECRET
const got = new URL(req.url).searchParams.get('secret')

// safe debug, no secret printed
if (!secret || got !== secret) {
  return NextResponse.json(
    {
      ok: false,
      error: 'unauthorized',
      debug: {
        hasEnvSecret: !!secret,
        gotIsNull: got === null,
        gotLen: got ? got.length : 0,
        envLen: secret ? secret.length : 0,
      },
    },
    { status: 401 }
  )
}


    const rows = await buildInkProtocolRankings()
    const payload = { rows }

    const { error } = await supabaseAdmin
      .from('ink_metrics_cache')
      .upsert({ key: KEY, payload, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) throw error

    return NextResponse.json({ ok: true, key: KEY, count: rows.length, updatedAt: Date.now() })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, key: KEY, error: String(e?.message ?? e) },
      { status: 500 }
    )
  }
}
