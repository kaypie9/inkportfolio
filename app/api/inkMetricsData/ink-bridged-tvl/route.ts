import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const toNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function GET() {
  const url = "https://api.llama.fi/chainAssets";

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, chain: "Ink", bridged_tvl: null, error: { url, status: res.status } },
        { status: 500 }
      );
    }

    const json: any = await res.json();

    const ink =
      json?.Ink ??
      json?.ink ??
      json?.InkOnChain ??
      json?.inkonchain ??
      null;

    if (!ink) {
      return NextResponse.json(
        { ok: false, chain: "Ink", bridged_tvl: null, error: { url, msg: "Ink not found", keys: Object.keys(json || {}).slice(0, 50) } },
        { status: 500 }
      );
    }

    const canonical = toNum(ink?.canonical?.total);
    const native = toNum(ink?.native?.total);
    const thirdParty = toNum(ink?.thirdParty?.total);

    const bridged_tvl =
      [canonical, native, thirdParty].every((x) => typeof x === "number")
        ? (canonical as number) + (native as number) + (thirdParty as number)
        : null;

    return NextResponse.json({
      ok: true,
      chain: "Ink",
      bridged_tvl,
      canonical,
      native,
      thirdParty,
      timestamp: json?.timestamp ?? null,
      source: url,
      ts: Date.now(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, chain: "Ink", bridged_tvl: null, error: { url, msg: e?.message || String(e) } },
      { status: 500 }
    );
  }
}
