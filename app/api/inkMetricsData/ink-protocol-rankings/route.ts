import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const KEY = 'ink-protocol-rankings'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('ink_metrics_cache')
      .select('payload, updated_at')
      .eq('key', KEY)
      .maybeSingle()

    if (error) throw error

    const rowsOut = Array.isArray(data?.payload?.rows) ? data!.payload.rows : []

    return NextResponse.json({
      ok: true,
      updatedAt: data?.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
      rows: rowsOut,
    })
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, updatedAt: Date.now(), rows: [], error: String(e?.message ?? e) },
      { status: 500 }
    )
  }
}
