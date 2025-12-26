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
    label: 'Stargate',
    icon: 'Stargate Finance',
    url: '',
    contracts: [
      '0xf1815bd50389c46847f0bda824ec8da914045d14',
      '',
      '',
    ],
  },
   {
    label: 'Relay',
    icon: 'Relay',
    url: '',
    contracts: [
      '0xccc88a9d1b4ed6b0eaba998850414b24f1c315be',
      '',
      '',
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
    label: 'TheDeep',
    icon: 'TheDeep',
    url: 'https://app.thedeep.ink/ink/explore',
    contracts: [
      '0x8e3954c71bb583129635ee9dcaa9ac9f0ae2ea96',
      '0x65CD1f0ac298519BE4891B5812053e00BD2074AC',
      '0xcbd1f70235904d3764f5d159022ba0281536e3e8',
      '0x53511764DE94CdA43CbBadFFCca3F29D2EFAB0F8',
    ],
  },
  {
    label: 'Nado',
    icon: 'Nado',
    url: 'https://app.nado.xyz/',
    contracts: [
      '0x05ec92d78ed421f3d3ada77ffde167106565974e',
      '0x09fb495aa7859635f755e827d64c4c9a2e5b9651',
    ],
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
    contracts: [
      '0x355912b2f4cc9da67975cbf2685aaf9874a4d631',
    ],
  },
  {
  label: 'Curve',
  icon: 'curve',
  url: 'https://curve.fi',
  contracts: [],
},
{
  label: 'Ionic',
  icon: 'ionic-protocol',
  url: 'https://ionic.money',
  contracts: [],
},
{
  label: 'Makina',
  icon: 'makina-finance',
  url: '',
  contracts: [],
},
{
  label: 'Tydro',
  icon: 'tydro',
  url: '',
  contracts: [],
},
{
  label: 'DYORswap',
  icon: 'dyorswap',
  url: '',
  contracts: [],
},
{
  label: 'Frax',
  icon: 'frax',
  url: 'https://frax.finance',
  contracts: [],
},
{
  label: 'Kraken',
  icon: 'kraken',
  url: 'https://www.kraken.com',
  contracts: [],
},
{
  label: 'Aave',
  icon: 'aave',
  url: 'https://aave.com',
  contracts: [],
},
{
  label: 'SpeedRun Ethereum',
  icon: 'speedrun-ethereum',
  url: 'https://speedrunethereum.com',
  contracts: [],
},
{
  label: 'Shroomy',
  icon: 'shroomy',
  url: '',
  contracts: [],
},
{
  label: 'PWN',
  icon: 'pwn',
  url: '',
  contracts: [],
},
{
  label: 'Exactly',
  icon: 'exactly-protocol',
  url: '',
  contracts: [],
},
{
  label: 'DropToken',
  icon: 'droptoken',
  url: '',
  contracts: [],
},
{
  label: 'AstroSwap',
  icon: 'astroswap',
  url: '',
  contracts: [],
},
{
  label: 'LayerSwap',
  icon: 'layerswap',
  url: 'https://layerswap.io',
  contracts: [],
},
{
  label: 'Fly',
  icon: 'fly',
  url: '',
  contracts: [],
},
{
  label: 'Owito',
  icon: 'owito',
  url: '',
  contracts: [],
},
{
  label: 'SquidSwap',
  icon: 'squidswap',
  url: '',
  contracts: [],
},
{
  label: 'SuperSwap',
  icon: 'superswap',
  url: '',
  contracts: [],
},
{
  label: 'Firefly',
  icon: 'firefly',
  url: '',
  contracts: [],
},
{
  label: 'WheelX',
  icon: 'wheelx',
  url: '',
  contracts: [],
},
{
  label: 'Encrypt',
  icon: 'encrypt',
  url: '',
  contracts: [],
},
{
  label: 'RaccoonFi',
  icon: 'raccoonfi',
  url: '',
  contracts: [],
},
{
  label: 'AceOfSwaps',
  icon: 'aceofswaps',
  url: '',
  contracts: [],
},
{
  label: 'Zapper',
  icon: 'zapper',
  url: 'https://zapper.xyz',
  contracts: [],
},
{
  label: '0x',
  icon: '0x',
  url: 'https://0x.org',
  contracts: [],
},
{
  label: 'Jumper',
  icon: 'jumper',
  url: 'https://jumper.exchange',
  contracts: [],
},
{
  label: 'RhinoFi',
  icon: 'rhinofi',
  url: 'https://rhino.fi',
  contracts: [],
},
{
  label: 'Trade on Ink',
  icon: 'trade-on-ink',
  url: '',
  contracts: [],
},
{
  label: 'Reservoir',
  icon: 'reservoir',
  url: '',
  contracts: [],
},
{
  label: 'Rails',
  icon: 'rails',
  url: '',
  contracts: [],
},
{
  label: 'Web3 Packs',
  icon: 'web3-packs',
  url: '',
  contracts: [],
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

export function getProtocolByLabel(label?: string | null): ProtocolDef | null {
  const k = (label || '').trim().toLowerCase()
  if (!k) return null
  const hit = PROTOCOLS.find(p => (p.label || '').trim().toLowerCase() === k)
  return hit || null
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
    Other: 'link',
}

export function getPositionUrl(positionType?: string | null): string | null {
  const k = (positionType || '').trim()
  const u = (POSITION_URLS as any)[k] || ''
  return u ? u : null
}

