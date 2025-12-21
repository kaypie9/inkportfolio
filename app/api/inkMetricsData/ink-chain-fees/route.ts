import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const pickTotal24h = (obj: any) => {
  const keys = [
    "total24h",
    "total1d",
    "total",
    "fees24h",
    "revenue24h",
    "dailyFees",
    "dailyRevenue",
  ];
  for (const k of keys) {
    const n = toNum(obj?.[k]);
    if (n !== null) return n;
  }
  return null;
};

async function fetchAny(urls: string[]) {
  let last: any = null;

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        last = { url, status: res.status };
        continue;
      }
      const json = await res.json();
      return { ok: true, url, json };
    } catch (e: any) {
      last = { url, error: e?.message || String(e) };
    }
  }

  return { ok: false, last };
}

export async function GET() {
  // chain gas fees live on /summary/fees in many cases
  // we try a few common identifiers because DefiLlama slugs vary per chain
  const chainIds = ["ink", "Ink", "inkonchain", "InkOnChain"];

  const feeUrls: string[] = [];
  const revUrls: string[] = [];

  for (const id of chainIds) {
    feeUrls.push(`https://api.llama.fi/summary/fees/${id}?dataType=dailyFees`);
    revUrls.push(`https://api.llama.fi/summary/fees/${id}?dataType=dailyRevenue`);
  }

  const feesRes = await fetchAny(feeUrls);
  const revRes = await fetchAny(revUrls);

  if (!feesRes.ok || !revRes.ok) {
    return NextResponse.json(
      {
        ok: false,
        chain: "Ink",
        error: {
          fees: feesRes.ok ? null : feesRes.last,
          revenue: revRes.ok ? null : revRes.last,
        },
      },
      { status: 500 }
    );
  }

  const chain_fees_24h = pickTotal24h(feesRes.json);
  const chain_revenue_24h = pickTotal24h(revRes.json);

  return NextResponse.json({
    ok: true,
    chain: "Ink",
    chain_fees_24h,
    chain_revenue_24h,
    chain_rev_24h: chain_revenue_24h,
    sources: {
      fees: feesRes.url,
      revenue: revRes.url,
    },
    ts: Date.now(),
  });
}
