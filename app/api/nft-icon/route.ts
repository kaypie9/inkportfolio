import { NextResponse } from 'next/server';

const BLOCKSCOUT_BASE = 'https://explorer.inkonchain.com/api/v2';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const addr = url.searchParams.get('address');

  if (!addr) {
    return NextResponse.json({ iconUrl: null });
  }

  try {
    const res = await fetch(
      `${BLOCKSCOUT_BASE}/tokens/${addr.toLowerCase()}`
    );

    if (!res.ok) {
      console.error('nft-icon upstream failed', res.status);
      return NextResponse.json({ iconUrl: null });
    }

const data = await res.json();

const iconUrl =
  data?.icon_url ||
  data?.image_url ||
  data?.token?.icon_url ||
  null;

return NextResponse.json({ iconUrl });

  } catch (e) {
    console.error('nft-icon crashed', e);
    return NextResponse.json({ iconUrl: null });
  }
}
