import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function toNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const url = "https://bridges.llama.fi/bridgevolume/Ink";

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, chain: "Ink", inflows24hUsd: null, error: { url, status: res.status } },
        { status: 500 }
      );
    }

    const arr: any[] = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      return NextResponse.json(
        { ok: false, chain: "Ink", inflows24hUsd: null, error: { url, msg: "empty response" } },
        { status: 500 }
      );
    }

    const last = arr[arr.length - 1];

    const depositUSD = toNum(last?.depositUSD);
    const withdrawUSD = toNum(last?.withdrawUSD);

    if (depositUSD === null || withdrawUSD === null) {
      return NextResponse.json(
        {
          ok: false,
          chain: "Ink",
          inflows24hUsd: null,
          error: { url, msg: "missing depositUSD or withdrawUSD", keys: Object.keys(last || {}) },
        },
        { status: 500 }
      );
    }

const inflows24hUsd = depositUSD;

    return NextResponse.json({
      ok: true,
      chain: "Ink",
      inflows24hUsd,
      depositUSD,
      withdrawUSD,
      date: last?.date ?? null,
      source: url,
      ts: Date.now(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, chain: "Ink", inflows24hUsd: null, error: { url, msg: e?.message || String(e) } },
      { status: 500 }
    );
  }
}
