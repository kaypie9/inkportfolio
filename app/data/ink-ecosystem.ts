export type EcosystemLinkKey = 'app' | 'website' | 'twitter' | 'docs'

export type EcosystemItem = {
  id: string
  name: string
  description: string
  category: 'DeFi' | 'Bridge' | 'Infra' | 'Explorer' | 'Tools' | 'NFTs' | 'Games' | 'Wallet'
  tags?: string[]
  featured?: boolean
  badges?: string[]
  icon?: string
  llamaSlug?: string
  links: Partial<Record<EcosystemLinkKey, string>>
}


export const inkEcosystem: EcosystemItem[] = [
  {
    id: 'nado',
    name: 'Nado',
    description: 'All-in-one DEX for spot and perps, powered by unified margin. From Kraken Team.',
    category: 'DeFi',
    featured: true,
    badges: ['AIRDROP', 'FEATURED'],
    tags: ['dex', 'perps'],
    links: {
      app: 'https://app.nado.xyz',
      website: 'https://nado.xyz',
      twitter: 'https://x.com/nadodex',
      docs: 'https://docs.nado.xyz',
    },
  },
  {
    id: 'tydro',
    name: 'Tydro',
    description: 'Non-custodial liquidity protocol built on Ink, powered by Aave.',
    category: 'DeFi',
    featured: true,
    badges: ['AIRDROP', 'FEATURED'],
    tags: ['borrowing', 'tools'],
    links: {
      website: 'https://tydro.fi',
      twitter: 'https://x.com/tydrofi',
    },
  },
  {
    id: 'kraken-wallet',
    name: 'Kraken Wallet',
    description: 'Self-custody wallet to connect to the decentralized web safely.',
    category: 'Wallet',
    featured: true,
    badges: ['FEATURED'],
    tags: ['wallet'],
    links: {
      website: 'https://www.kraken.com/wallet',
      twitter: 'https://x.com/krakenfx',
    },
  },
  {
    id: 'blockscout',
    name: 'Blockscout',
    description: 'Explorer portal for searching transactions, tokens, and contracts.',
    category: 'Explorer',
    tags: ['explorer'],
    links: {
      website: 'https://www.blockscout.com',
      twitter: 'https://x.com/blockscoutcom',
      docs: 'https://docs.blockscout.com',
    },
  },
   // === DEX / DEFI ===
  {
    id: 'velodrome',
    name: 'Velodrome',
    category: 'DeFi',
    description: 'Liquidity hub and AMM powering efficient swaps on Ink.',
    tags: ['dex', 'amm'],
    links: {
      app: 'https://app.velodrome.finance',
      twitter: 'https://x.com/VelodromeFi',
    },
  },
  {
    id: 'curve',
    name: 'Curve',
    category: 'DeFi',
    description: 'Stablecoin-focused AMM optimized for low slippage swaps.',
    tags: ['dex', 'stables'],
    links: {
      app: 'https://curve.fi',
      twitter: 'https://x.com/CurveFinance',
    },
  },
{
  id: 'dinero',
  name: 'Dinero',
  category: 'DeFi',
  description: 'DeFi protocol focused on yield strategies and capital efficiency.',
  tags: ['yield'],
  links: {
    app: 'https://',
    twitter: 'https://x.com/',
  },
},


  // === BRIDGES / CROSS-CHAIN ===
  {
    id: 'acrossprotocol',
    name: 'Across',
    category: 'Bridge',
    description: 'Fast, secure bridge with intent-based transfers.',
    tags: ['bridge', 'cross-chain'],
    links: {
      app: 'https://across.to',
      twitter: 'https://x.com/AcrossProtocol',
    },
  },
  {
    id: 'stargate',
    name: 'Stargate',
    category: 'Bridge',
    description: 'Liquidity transport layer for cross-chain assets.',
    tags: ['bridge', 'cross-chain'],
    links: {
      app: 'https://stargate.finance',
      twitter: 'https://x.com/StargateFinance',
    },
  },
  {
    id: 'relay',
    name: 'Relay',
    category: 'Bridge',
    description: 'Simple bridging and swapping across chains.',
    tags: ['bridge', 'cross-chain'],
            links: {
      app: 'https://',
      twitter: 'https://x.com/',
  },
   },
  {
    id: 'orbiter-finance',
    name: 'Orbiter',
    category: 'Bridge',
    description: 'Low-cost bridge optimized for L2 transfers.',
    tags: ['bridge', 'l2'],
            links: {
      app: 'https://',
      twitter: 'https://x.com/',
  },
   },
  {
    id: 'superbridge',
    name: 'Superbridge',
    category: 'Bridge',
    description: 'Unified interface for bridging across ecosystems.',
    tags: ['bridge', 'tools'],
            links: {
      app: 'https://',
      twitter: 'https://x.com/',
  },
   },
  {
    id: 'jumper-exchange',
    name: 'Jumper',
    category: 'Bridge',
    description: 'Cross-chain swap and bridge aggregator by LI.FI.',
    tags: ['bridge', 'aggregator'],
    links: {
      app: 'https://jumper.exchange',
    },
  },

  // === TOOLS / INFRA ===
{
  id: '0x',
  name: '0x',
  category: 'Infra',
  description: 'Swap infrastructure and liquidity aggregation for applications.',
  tags: ['swap', 'infra'],
  links: {
    website: 'https://0x.org',
    twitter: 'https://x.com/0xProject',
  },
},

  {
    id: 'layerzero',
    name: 'LayerZero',
    category: 'Infra',
    description: 'Omnichain messaging protocol for cross-chain apps.',
    tags: ['infra', 'cross-chain'],
            links: {
      app: 'https://',
      twitter: 'https://x.com/',
  },
   },
  {
    id: 'pyth',
    name: 'Pyth',
    category: 'Infra',
    description: 'High-frequency oracle network delivering real-time prices.',
    tags: ['oracle', 'infra'],
            links: {
      app: 'https://',
      twitter: 'https://x.com/',
  },
   },
  {
    id: 'dune',
    name: 'Dune',
    category: 'Tools',
    description: 'Blockchain analytics and dashboards powered by SQL.',
    tags: ['analytics', 'tools'],
            links: {
      app: 'https://',
      twitter: 'https://x.com/',
  },
   },
  {
    id: 'routescan',
    name: 'Routescan',
    category: 'Explorer',
    description: 'Explorer and analytics platform for modular chains.',
    tags: ['explorer', 'analytics'],
            links: {
      app: 'https://',
      twitter: 'https://x.com/',
  },
   },

  // === NFT / SOCIAL ===
{
  id: 'nfts2me',
  name: 'NFTs2Me',
  category: 'NFTs',
  description: 'No-code platform to create, deploy, and manage NFT collections.',
  tags: ['nft', 'tools'],
  links: {
    app: 'https://',
    twitter: 'https://x.com/',
  },
},

{
  id: 'inkyswap',
  name: 'InkySwap',
  category: 'DeFi',
  description: 'Decentralized exchange on Ink for token swaps and liquidity.',
  tags: ['dex'],
  links: {
    app: 'https://',
    twitter: 'https://x.com/',
  },
},

  {
    id: 'inkypump',
    name: 'InkyPump',
    category: 'Tools',
    description: 'Token launch and discovery tooling on Ink.',
    tags: ['launch', 'tools'],
            links: {
      app: 'https://',
      twitter: 'https://x.com/',
  },
   },

  // === MISC / UTILS ===
  {
    id: 'gas-zip',
    name: 'Gas.zip',
    category: 'Tools',
    description: 'One-click gas funding across chains.',
    tags: ['gas', 'tools'],
            links: {
      app: 'https://',
      twitter: 'https://x.com/',
  },
   },
{
  id: 'znsconnect',
  name: 'ZNS Connect',
  category: 'Infra',
  description: 'Onchain naming system for decentralized identities.',
  tags: ['domains', 'identity'],
  links: {
    app: 'https://',
    twitter: 'https://x.com/',
  },
},

{
  id: '3dns',
  name: '3DNS',
  category: 'Infra',
  description: 'Decentralized domain infrastructure for web3 identities.',
  tags: ['domains', 'infra'],
  links: {
    app: 'https://',
    twitter: 'https://x.com/',
  },
},

   {
  id: 'kraken',
  name: 'Kraken',
  category: 'Tools',
  description:
    'Centralized crypto platform for buying, selling, trading, and managing digital assets.',
  tags: ['exchange', 'funding'],
  featured: true,
  links: {
    website: 'https://www.kraken.com',
    twitter: 'https://x.com/krakenfx',
  },
}

]
