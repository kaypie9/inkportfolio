import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json({ error: "missing wallet" }, { status: 400 });
  }

  try {
    const upstream = await fetch(
      `https://gm.inkonchain.com/api/user-leaderboard?address=${wallet.toLowerCase()}`,
      { cache: "no-store" }
    );

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "gm upstream error", status: upstream.status },
        { status: 502 }
      );
    }

    const json = await upstream.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("gm upstream crashed", err);
    return NextResponse.json(
      { error: "gm fetch failed" },
      { status: 500 }
    );
  }
}
