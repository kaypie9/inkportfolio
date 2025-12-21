import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendFeedbackEmail } from '@/lib/email';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const message = (body?.message ?? '').toString().trim();
    const category = (body?.category ?? 'feature').toString().trim();
    const contact = (body?.contact ?? '').toString().trim();
    const wallet = (body?.wallet ?? '').toString().trim();

    if (!message) {
      return NextResponse.json(
        { ok: false, error: 'Message is required' },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from('feedback')
      .insert({
        message,
        category,
        contact,
        wallet: wallet || null,
        meta: body?.meta ?? null,
      });

    if (error) {
      console.error('feedback insert error', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to save feedback' },
        { status: 500 },
      );
    }

    // fire and forget email, do not block or fail the request if email fails
    sendFeedbackEmail({
      message,
      category,
      contact,
      wallet: wallet || null,
    }).catch(err => {
      console.error('feedback email send failed', err);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('feedback route error', err);
    return NextResponse.json(
      { ok: false, error: 'Invalid request' },
      { status: 400 },
    );
  }
}
