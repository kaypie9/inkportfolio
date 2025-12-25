export type ProtocolDef = {
  label: string
  icon: string
  url?: string
  contracts?: string[]
}

export const PROTOCOLS: ProtocolDef[] = [
  {
    label: 'Inkyswap',
    icon: 'Inkyswap',
    url: 'https://inkyswap.com/swap',
    contracts: [
      '0x1d74317d760f2c72a94386f50e8d10f2c902b899',
      '0xa8c1c38ff57428e5c3a34e0899be5cb385476507',
      '0x458c5d5b75ccba22651d2c5b61cb1ea1e0b0f95d',
    ],
  },
  {
    label: 'Dailygm',
    icon: 'dailygm',
    contracts: [
      '0x9f500d075118272b3564ac6ef2c70a9067fd2d3f',
    ],
  },

  {
    label: 'Nado',
    icon: 'Nado',
    url: 'https://app.nado.xyz/',
    contracts: ['0x05ec92d78ed421f3d3ada77ffde167106565974e'],
  },
  {
    label: 'LiFi',
    icon: 'lifi',
    contracts: [
      '0x864b314d4c5a0399368609581d3e8933a63b9232',
      '0x1bcd304fdad1d1d66529159b1bc8d13c9158d586',
    ],
  },
  {
    label: 'Velodrome',
    icon: 'velodrome',
    url: 'https://velodrome.finance',
    contracts: ['0x31832f2a97fd20664d76cc421207669b55ce4bc0'],
  },
  {
    label: 'Dinero',
    icon: 'dinero',
    url: 'https://ink.dinero.xyz/app',
  },
]

const byAddress: Record<string, ProtocolDef> = Object.create(null)

for (const p of PROTOCOLS) {
  for (const c of p.contracts || []) {
    const k = (c || '').toLowerCase()
    if (!k) continue
    byAddress[k] = p
  }
}

export function getProtocolByAddress(address?: string | null): ProtocolDef | null {
  const k = (address || '').toLowerCase()
  return k && byAddress[k] ? byAddress[k] : null
}

export function getProtocolLabelByAddress(address?: string | null): string | null {
  const p = getProtocolByAddress(address)
  return p ? p.label : null
}

export function getProtocolIconByAddress(address?: string | null): string | null {
  const p = getProtocolByAddress(address)
  return p ? p.icon : null
}

export function getProtocolUrlByAddress(address?: string | null): string | null {
  const p = getProtocolByAddress(address)
  return p && p.url ? p.url : null
}

export const POSITION_URLS: Record<string, string> = {
  Vault: 'https://inkonchain.com/staking',
  Staked: 'https://inkonchain.com/staking',
  Deposits: 'https://inkonchain.com/staking',
  'Liquidity pool': 'https://inkonchain.com/swap',
  Other: '',
}

export function getPositionUrl(positionType?: string | null): string | null {
  const k = (positionType || '').trim()
  const u = (POSITION_URLS as any)[k] || ''
  return u ? u : null
}
