const NADO_GATEWAY = 'https://gateway.prod.nado.xyz/v1/query'

// hex for 'default' + padding, from Nado docs
const DEFAULT_SUBACCOUNT_SUFFIX = '64656661756c740000000000'

function toNadoSubaccount(address: string) {
  const addr = address.trim().toLowerCase()
  if (!addr.startsWith('0x') || addr.length !== 42) {
    throw new Error('invalid wallet')
  }
  return addr + DEFAULT_SUBACCOUNT_SUFFIX
}

type NadoHealth = {
  assets: string
  liabilities: string
  health: string
}

type NadoSubaccountInfo = {
  healths: NadoHealth[]
}

export async function fetchNadoUsdEquity(address: string): Promise<number> {
  if (!address) return 0

  let subaccount: string
  try {
    subaccount = toNadoSubaccount(address)
  } catch {
    return 0
  }

  const url = new URL(NADO_GATEWAY)
  url.searchParams.set('type', 'subaccount_info')
  url.searchParams.set('subaccount', subaccount)

  const res = await fetch(url.toString(), {
    headers: {
      'accept-encoding': 'gzip, deflate, br',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    console.error('nado error status', res.status)
    return 0
  }

  const json = (await res.json()) as {
    status: string
    data?: NadoSubaccountInfo
  }

  if (json.status !== 'success' || !json.data) return 0
  if (!json.data.healths || json.data.healths.length < 3) return 0

  // healths[2].health = unweighted equity in 1e18
  const equityX18 = BigInt(json.data.healths[2].health)
  if (equityX18 <= 0n) return 0

  const ONE_E18 = 10n ** 18n
  const usd = Number(equityX18) / Number(ONE_E18)

  return usd
}
