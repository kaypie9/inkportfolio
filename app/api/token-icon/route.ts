import { NextResponse } from "next/server"

const BLOCKSCOUT_BASE = "https://explorer.inkonchain.com/api/v2"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get("address")?.toLowerCase()

  if (!address) {
    return NextResponse.json({ iconUrl: null }, { status: 400 })
  }

  try {
    // 1) try explorer icon first (same source as wallet table)
    try {
      const resExplorer = await fetch(`${BLOCKSCOUT_BASE}/tokens/${address}`, {
        next: { revalidate: 600 },
      })

      if (resExplorer.ok) {
        const data = await resExplorer.json()
        const explorerIcon = (data as any)?.icon_url
        if (typeof explorerIcon === "string" && explorerIcon.length > 0) {
          return NextResponse.json({ iconUrl: explorerIcon }, { status: 200 })
        }
      }
    } catch (e) {
      console.error("token-icon explorer failed", e)
    }

    // 2) fallback to dexscreener by address (not generic search)
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { next: { revalidate: 600 } },
    )

    if (!res.ok) {
      console.error("token-icon dexscreener failed", res.status)
      return NextResponse.json({ iconUrl: null }, { status: 200 })
    }

    const data = await res.json()
    const pair = Array.isArray((data as any).pairs)
      ? (data as any).pairs[0]
      : undefined

    const iconUrl =
      pair && typeof pair.info?.imageUrl === "string"
        ? pair.info.imageUrl
        : null

    return NextResponse.json({ iconUrl }, { status: 200 })
  } catch (e) {
    console.error("token-icon api crashed", e)
    return NextResponse.json({ iconUrl: null }, { status: 200 })
  }
}
