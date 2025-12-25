// app/api/portfolio-history/route.ts

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rateLimit'

export async function GET(req: Request) {
  
  const url = new URL(req.url);
  const wallet = url.searchParams.get('wallet');
  const hoursParam = url.searchParams.get('hours');

  if (!wallet) {
    return NextResponse.json(
      { error: 'wallet param is required' },
      { status: 400 },
    );
  }

  // how many hours back to look, default 24
  const hours = hoursParam ? Number(hoursParam) || 24 : 24;

  const now = Date.now();
  const fromIso = new Date(now - hours * 60 * 60 * 1000).toISOString();

  if (!supabaseAdmin) {
    console.error('supabase not configured');
    return NextResponse.json(
      { error: 'supabase not configured' },
      { status: 500 },
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('networth_snapshots')
      .select('created_at, total_value_usd')
      .eq('wallet_address', wallet.toLowerCase())
      .gte('created_at', fromIso)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('history query error', error.message);
      return NextResponse.json(
        { error: 'history query failed' },
        { status: 500 },
      );
    }

    // map to a clean shape for the frontend
    const points = (data || []).map((row) => ({
      timestamp: row.created_at,
      value: Number(row.total_value_usd ?? 0),
    }));

    return NextResponse.json({
      wallet: wallet.toLowerCase(),
      hours,
      points,
    });
  } catch (err) {
    console.error('history route error', err);
    return NextResponse.json(
      { error: 'history route failed' },
      { status: 500 },
    );
  }
}
