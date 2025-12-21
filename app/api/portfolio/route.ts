// app/api/portfolio/route.ts

import { NextResponse } from 'next/server';
import { fetchNadoUsdEquity } from '@/lib/nado';


const RPC_URL =
  process.env.NEXT_PUBLIC_INK_RPC || 'https://rpc-gel.inkonchain.com';

const BLOCKSCOUT_BASE = 'https://explorer.inkonchain.com/api/v2';
const BLOCKSCOUT_RPC_BASE = 'https://explorer.inkonchain.com/api';

const CREATOR_CACHE: Record<string, string | null> = {};

const NADO_MARGIN_CONTRACT =
  '0x05ec92d78ed421f3d3ada77ffde167106565974e'.toLowerCase();

type TokenIconMeta = {
  iconUrl?: string;
};

async function getTokenIconMeta(address: string): Promise<TokenIconMeta> {
  try {
    if (!address) return {};

    // 1) try explorer /tokens
    try {
      const resExplorer = await fetch(`${BLOCKSCOUT_BASE}/tokens/${address}`);
      if (resExplorer.ok) {
        const data = await resExplorer.json();
        const icon = (data as any)?.icon_url;
        if (typeof icon === 'string' && icon.length > 0) {
          return { iconUrl: icon };
        }
      }
    } catch (e) {
      console.error('explorer icon fetch failed', e);
    }

    // 2) fallback to dexscreener
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${address}`,
      { next: { revalidate: 300 } },
    );

    if (!res.ok) return {};

    const data = await res.json();
    const pair = Array.isArray((data as any).pairs)
      ? (data as any).pairs[0]
      : undefined;
    if (!pair) return {};

    const info = pair.info || {};
    const iconUrl =
      typeof info.imageUrl === 'string' && info.imageUrl.length > 0
        ? info.imageUrl
        : undefined;

    return { iconUrl };
  } catch (e) {
    console.error('getTokenIconMeta failed', e);
    return {};
  }
}

// read owner() from any Ownable contract
async function readFactoryOwner(factoryAddr: string): Promise<string | null> {
  try {
    const data = "0x8da5cb5b"; // owner()
    const hex = await ethCallRaw(factoryAddr, data);
    const body = hex.replace(/^0x/, "");
    if (body.length < 64) return null;

    const addr = "0x" + body.slice(24, 64);
    return addr.toLowerCase();
  } catch {
    return null;
  }
}

// read factory() from a UniswapV2 / Solidly / Velodrome style pool
async function readFactory(pairAddr: string): Promise<string | null> {
  try {
    const data = "0xc45a0155"; // factory()
    const hex = await ethCallRaw(pairAddr, data);
    const body = hex.replace(/^0x/, "");
    if (body.length < 64) return null;

    const addr = "0x" + body.slice(24, 64);
    return addr.toLowerCase();
  } catch {
    return null;
  }
}

// full logic: pool → factory → owner
async function resolveCreatorAddress(pairAddr: string): Promise<string | null> {
  try {
    const factory = await readFactory(pairAddr);
    if (!factory) return null;

    const owner = await readFactoryOwner(factory);
    if (owner) return owner;

    // fallback: factory itself is the creator
    return factory;
  } catch {
    return null;
  }
}

const BIGINT_ZERO = BigInt(0);

async function ethCallRaw(to: string, data: string): Promise<string> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [
          {
            to,
            data,
          },
          'latest',
        ],
      }),
    });

    const json = await res.json();
    const hex = String(json.result || '0x0');
    return hex;
  } catch (e) {
    console.error('ethCallRaw failed', e);
    return '0x0';
  }
}

function hexToBigInt(hex: string): bigint {
  if (!hex || typeof hex !== 'string') return BIGINT_ZERO;
  try {
    return BigInt(hex);
  } catch {
    return BIGINT_ZERO;
  }
}


async function readTotalSupply(tokenAddr: string): Promise<bigint> {
  // totalSupply()
  const data = '0x18160ddd';
  const hex = await ethCallRaw(tokenAddr, data);
  return hexToBigInt(hex);
}

// Uniswap V2 style views to auto detect LP pairs

// token0()
async function readToken0(pairAddr: string): Promise<string> {
  const data = '0x0dfe1681';
  const hex = await ethCallRaw(pairAddr, data);
  const body = hex.replace(/^0x/, '');
  if (body.length < 64) return '';
  const field = body.slice(0, 64);
  const addrHex = '0x' + field.slice(24); // last 20 bytes
  return addrHex.toLowerCase();
}

// token1()
async function readToken1(pairAddr: string): Promise<string> {
  const data = '0xd21220a7';
  const hex = await ethCallRaw(pairAddr, data);
  const body = hex.replace(/^0x/, '');
  if (body.length < 64) return '';
  const field = body.slice(0, 64);
  const addrHex = '0x' + field.slice(24);
  return addrHex.toLowerCase();
}

// decimals()
async function readDecimals(tokenAddr: string): Promise<number> {
  const data = '0x313ce567';
  const hex = await ethCallRaw(tokenAddr, data);
  const body = hex.replace(/^0x/, '');
  if (body.length < 64) return 18;

  const field = '0x' + body.slice(0, 64);
  try {
    const n = Number(BigInt(field));
    if (!Number.isFinite(n) || n <= 0 || n > 36) return 18;
    return n;
  } catch {
    return 18;
  }
}

// Uniswap V2 style getReserves()
async function readReserves(
  pairAddr: string,
): Promise<{ reserve0: bigint; reserve1: bigint }> {
  const data = '0x0902f1ac';
  const hex = await ethCallRaw(pairAddr, data);
  const body = hex.replace(/^0x/, '');

   if (body.length < 64 * 2) {
    return { reserve0: BIGINT_ZERO, reserve1: BIGINT_ZERO };
  }


  const r0Hex = '0x' + body.slice(0, 64);
  const r1Hex = '0x' + body.slice(64, 128);

  return {
    reserve0: hexToBigInt(r0Hex),
    reserve1: hexToBigInt(r1Hex),
  };
}

type TokenHolding = {
  address: string;
  symbol: string;
  name?: string;
  decimals: number;
  rawBalance: string;
  balance: number;
  priceUsd?: number;
  valueUsd?: number;
  iconUrl?: string;
  lpBreakdown?: {
    token0Symbol: string;
    token1Symbol: string;
    amount0: number;
    amount1: number;
    token0Address: string;
    token1Address: string;
    token0IconUrl?: string;
    token1IconUrl?: string;
  };
};


type VaultPosition = {
  tokenAddress: string;
  symbol: string;
  protocol: string;
  poolName: string;
  amount: number;
  depositedUsd: number;
  rewardsUsd?: number;
  apr?: number;
  lpBreakdown?: {
    token0Symbol: string;
    token1Symbol: string;
    amount0: number;
    amount1: number;
    token0Address: string;
    token1Address: string;
    token0IconUrl?: string;
    token1IconUrl?: string;
  };
  creatorAddress: string | null;
  iconUrl?: string;
};



async function fetchTokenSymbol(addr: string): Promise<string> {
  try {
    const res = await fetch(`${BLOCKSCOUT_BASE}/tokens/${addr}`);
    if (!res.ok) return '';
    const data = await res.json();
    return data?.symbol || '';
  } catch {
    return '';
  }
}

function guessVaultFromToken(
  t: TokenHolding,
): { protocol: string; pool: string } | null {
    // if backend already decomposed it as an LP, treat as yielding
  if (t.lpBreakdown) {
    const poolLabel = t.name || t.symbol || 'LP position';

    return {
      protocol: 'Onchain',
      pool: poolLabel,
    };
  }

  const sym = (t.symbol || '').toUpperCase();
  const nm = (t.name || '').toUpperCase();
  const combined = `${sym} ${nm}`;

// Dinero LSTs auto detection
if (
  sym.includes('IETH') ||
  sym === 'IET' ||
  sym.includes('ULTRA') ||
  sym.includes('ULT') ||
  nm.includes('STAKED') ||
  nm.includes('DINERO')
) {
  // use the token's own symbol as pool name
  return { protocol: 'Dinero', pool: sym };
}


  // AMM and v2 style LPs - sAMMV2, vAMMV2, UNI-V2 etc
  if (
    combined.includes('AMMV2') ||
    combined.includes('SAMMV2') ||
    combined.includes('VAMMV2') ||
    combined.includes('UNI-V2') ||
    combined.includes(' V2 ')
  ) {
    return { protocol: 'Onchain', pool: nm || sym || 'LP position' };
  }

  // generic LP / pool tokens
  if (sym.includes('LP') || nm.includes('LP TOKEN') || nm.includes('LIQUIDITY')) {
    return { protocol: 'Onchain', pool: 'LP position' };
  }

  // ink specific hints - tweak anytime
  if (sym.includes('HYDRO') || nm.includes('HYDRO')) {
    return { protocol: 'Hydrothermal', pool: 'Vault' };
  }

  if (sym.includes('DCA') || nm.includes('DCA')) {
    return { protocol: 'InkDCA', pool: 'Vault' };
  }

  // generic staked wrappers
  if (sym.startsWith('STK') || (sym.startsWith('S') && sym.includes('STK'))) {
    return { protocol: 'Staked', pool: 'Staking' };
  }

  return null;
}

async function getNativeBalance(address: string): Promise<number> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
      }),
    });

    const data = await res.json();
    if (!data.result) return 0;

    // data.result is hex string like 0x1234
    const hex = String(data.result);
    const wei = parseInt(hex, 16);
    if (!Number.isFinite(wei)) return 0;

    return wei / 1e18;
  } catch (err) {
    console.error('native balance error', err);
    return 0;
  }
}

async function fetchErc20Tokens(address: string): Promise<TokenHolding[]> {
  try {
    const res = await fetch(
      `${BLOCKSCOUT_BASE}/addresses/${address}/tokens?type=ERC-20`,
      {
        next: { revalidate: 30 },
      },
    );

    if (!res.ok) {
      console.error('blockscout status', res.status);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data.items)) return [];

    return data.items.map((item: any) => {
      const token = item.token || {};
      const name = String(token.name || '');
      const raw = String(item.value ?? '0');
      const decimals = Number(token.decimals ?? 18);

      let balance = 0;
      try {
        // raw is usually decimal string
        const units = BigInt(raw);
        balance = Number(units) / 10 ** decimals;
      } catch {
        balance = 0;
      }

const rawAddr =
  token.address ||
  token.address_hash ||
  token.contractAddress ||
  item.token_address ||
  item.address ||
  item.contract_address ||
  '';

let addr = String(rawAddr).toLowerCase();
const symbol = String(token.symbol || '');
const tokenName = String(token.name || '');

const iconUrl =
  typeof token.icon_url === 'string' ? token.icon_url : '';


      if (!addr && symbol.toUpperCase() === 'ANITA') {
        addr = '0x0606fc632ee812ba970af72f8489baaa443c4b98'.toLowerCase();
      }

return {
  address: addr,
  symbol,
  name: tokenName,
  decimals,
  rawBalance: raw,
  balance,
  iconUrl,
};

    });
  } catch (err) {
    console.error('blockscout fetch failed', err);
    return [];
  }
}

async function getEthUsdPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { next: { revalidate: 60 } },
    );

    if (!res.ok) {
      console.error('coingecko status', res.status);
      return 0;
    }

    const data = await res.json();
    const price = data.ethereum?.usd;
    if (typeof price !== 'number') return 0;
    return price;
  } catch (err) {
    console.error('price api failed', err);
    return 0;
  }
}

type TokenMarketData = {
  priceUsd: number;
  logoUrl?: string;
};

async function getTokenMarketData(address: string): Promise<TokenMarketData> {
  try {
    if (!address) {
      return { priceUsd: 0 };
    }

const res = await fetch(
  `https://api.dexscreener.com/latest/dex/tokens/${address}`,
  { next: { revalidate: 300 } }
)

    if (!res.ok) {
      console.error('dexscreener status', res.status);
      return { priceUsd: 0 };
    }

    const data = await res.json();
    const pair = Array.isArray(data.pairs) ? data.pairs[0] : undefined;
    if (!pair) {
      return { priceUsd: 0 };
    }

    const price = Number(pair.priceUsd || 0);
    const info = pair.info || {};
    const logoUrl =
      typeof info.imageUrl === 'string' && info.imageUrl.length > 0
        ? info.imageUrl
        : undefined;

    return {
      priceUsd: Number.isFinite(price) ? price : 0,
      logoUrl,
    };
  } catch (err) {
    console.error('dexscreener failed', err);
    return { priceUsd: 0 };
  }
}

function looksLikeLpToken(t: TokenHolding): boolean {
  const sym = (t.symbol || '').toUpperCase();
  const nm = (t.name || '').toUpperCase();
  const combined = `${sym} ${nm}`;

  const isLp =
    combined.includes('AMMV2') ||
    combined.includes('SAMMV2') ||
    combined.includes('VAMMV2') ||
    combined.includes('UNI-V2') ||
    combined.includes(' LP') ||
    combined.includes('-LP') ||
    combined.includes(' LIQUIDITY') ||
    combined.includes(' POOL');

  if (isLp) {
    console.log('LP DETECTED:', t.symbol, t.name, t.address);
  } else {
    console.log('NOT LP:', t.symbol, t.name);
  }

  return isLp;
}

// override LP token value with underlying pool assets, fully automatic
async function applyLpDecompositionAuto(
  tokens: TokenHolding[],
  priceMap: Record<string, number>,
): Promise<TokenHolding[]> {
  const out: TokenHolding[] = [];

  for (const t of tokens) {
    if (!t.address || !looksLikeLpToken(t)) {
      out.push(t);
      continue;
    }

    const pairAddr = t.address.toLowerCase();

    let userLp: bigint;
    try {
      userLp = BigInt(t.rawBalance || '0');
    } catch {
      out.push(t);
      continue;
    }
   if (userLp === BigInt(0)) {
      out.push(t);
      continue;
    }

    // try to read pair info, if any call fails just keep original token
    const [token0Addr, token1Addr] = await Promise.all([
      readToken0(pairAddr),
      readToken1(pairAddr),
    ]);

    if (!token0Addr || !token1Addr) {
      out.push(t);
      continue;
    }

    const [dec0, dec1] = await Promise.all([
      readDecimals(token0Addr),
      readDecimals(token1Addr),
    ]);

    const [totalSupply, { reserve0, reserve1 }] = await Promise.all([
      readTotalSupply(pairAddr),
      readReserves(pairAddr),
    ]);

if (totalSupply === BIGINT_ZERO) {
  out.push(t);
  continue;
}


    const share = Number(userLp) / Number(totalSupply);
    if (!Number.isFinite(share) || share <= 0) {
      out.push(t);
      continue;
    }

    const amount0 = (Number(reserve0) / 10 ** dec0) * share;
    const amount1 = (Number(reserve1) / 10 ** dec1) * share;

    const addr0 = token0Addr.toLowerCase();
    const addr1 = token1Addr.toLowerCase();

    let price0 = priceMap[addr0] || 0;
    let price1 = priceMap[addr1] || 0;

    if (!price0) {
      const m0 = await getTokenMarketData(addr0);
      price0 = m0.priceUsd || 0;
      if (price0) priceMap[addr0] = price0;
    }

    if (!price1) {
      const m1 = await getTokenMarketData(addr1);
      price1 = m1.priceUsd || 0;
      if (price1) priceMap[addr1] = price1;
    }

    const valueUsd = amount0 * price0 + amount1 * price1;

    // choose best label for underlying tokens
    // prefer symbol if it contains a '/', since that usually has 'TOKEN0/TOKEN1'
    const symbolLabel = (t.symbol || '').trim();
    const nameLabel = (t.name || '').trim();

    let labelForTokens = '';
    if (symbolLabel.includes('/')) {
      labelForTokens = symbolLabel;
    } else if (nameLabel.includes('/')) {
      labelForTokens = nameLabel;
    } else {
      labelForTokens = symbolLabel || nameLabel;
    }

    const rawPoolLabel = nameLabel || symbolLabel || 'LP position';

// fetch real token symbols from blockscout
// fetch real token symbols from blockscout + icons
const [sym0, sym1, iconMeta0, iconMeta1] = await Promise.all([
  fetchTokenSymbol(addr0),
  fetchTokenSymbol(addr1),
  getTokenIconMeta(addr0),
  getTokenIconMeta(addr1),
]);

const poolLabel = rawPoolLabel || 'LP position';

out.push({
  ...t,
  valueUsd,
  name: poolLabel,
  lpBreakdown: {
    token0Symbol: sym0,
    token1Symbol: sym1,
    amount0,
    amount1,
    token0Address: addr0,
    token1Address: addr1,
    token0IconUrl: iconMeta0.iconUrl,
    token1IconUrl: iconMeta1.iconUrl,
  },
});
  }

  return out;
}


export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const wallet = url.searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: 'wallet param is required' },
        { status: 400 },
      );
    }

const [nativeInk, tokens, ethUsd, nadoUsd] = await Promise.all([
  getNativeBalance(wallet),
  fetchErc20Tokens(wallet),
  getEthUsdPrice(),
  fetchNadoUsdEquity(wallet),
]);


console.log(
  'TOKENS FROM BLOCKSCOUT ===>',
  JSON.stringify(tokens, null, 2),
);


    const stableSymbols = new Set([
      'USDC',
      'USDT',
      'DAI',
      'GHO',
      'FRAX',
      'SUSD',
    ]);

    const addrList = Array.from(
      new Set(
        tokens
          .map((t) => t.address)
          .filter((addr) => addr && addr !== 'native'),
      ),
    ).slice(0, 20);

    const marketResults = await Promise.all(
      addrList.map((addr) => getTokenMarketData(addr)),
    );

    const priceMap: Record<string, number> = {};
    const logoMap: Record<string, string> = {};

    addrList.forEach((addr, i) => {
      const m = marketResults[i];
      if (!m) return;
      priceMap[addr] = m.priceUsd || 0;
      if (m.logoUrl) {
        logoMap[addr] = m.logoUrl;
      }
    });

let pricedTokens: TokenHolding[] = tokens.map((t) => {
const upper = (t.symbol || '').toUpperCase();
  let price = priceMap[t.address] || 0;

  if (stableSymbols.has(upper) && price === 0) {
    price = 1;
  }

  const value = price > 0 ? t.balance * price : 0;

  const iconUrl =
    t.iconUrl && t.iconUrl.length > 0
      ? t.iconUrl
      : logoMap[t.address] || undefined;

  return {
    ...t,
    priceUsd: price,
    valueUsd: value,
    iconUrl,
  };
});

// override LP token value with underlying pool amounts when known
pricedTokens = await applyLpDecompositionAuto(pricedTokens, priceMap);


    // auto-split tokens into spot vs yielding based on symbol and name
    const vaults: VaultPosition[] = [];
    const spotTokens: TokenHolding[] = [];

    for (const t of pricedTokens) {
      const hint = guessVaultFromToken(t);

      if (hint && t.balance > 0) {
        const price = t.priceUsd ?? 0;
        const valueUsd =
          t.valueUsd != null ? t.valueUsd : price * t.balance;

vaults.push({
  tokenAddress: t.address,
  symbol: t.symbol,
  protocol: hint.protocol,
  poolName: hint.pool,
  amount: t.balance,
  depositedUsd: valueUsd,
  rewardsUsd: 0,
  lpBreakdown: t.lpBreakdown,
  creatorAddress: null,
  iconUrl: t.iconUrl,
});
      } else {
        spotTokens.push(t);
      }
    }

    // virtual Nado margin account as a yielding position
if (nadoUsd && Number.isFinite(nadoUsd) && nadoUsd > 0) {
  vaults.push({
    tokenAddress: 'nado-margin',
    symbol: 'USDT', // Nado margin is USD-denominated
    protocol: 'Nado',
    poolName: 'Nado account',
    amount: nadoUsd,       // treat amount = equity in USD terms
    depositedUsd: nadoUsd, // 1:1 with USD value
    rewardsUsd: 0,
    creatorAddress: NADO_MARGIN_CONTRACT,
    iconUrl: undefined,
  });
}

    const stablesUsd = spotTokens
      .filter((t) => stableSymbols.has(t.symbol.toUpperCase()))
      .reduce((sum, t) => sum + (t.valueUsd || 0), 0);

    const nativeUsd = nativeInk * ethUsd;

    const tokensUsd = spotTokens.reduce(
      (sum, t) => sum + (t.valueUsd || 0),
      0,
    );

    const vaultDepositsUsd = vaults.reduce(
      (sum, v) => sum + (v.depositedUsd || 0),
      0,
    );

    const totalValueUsd = nativeUsd + tokensUsd + vaultDepositsUsd;

const enrichedVaults: VaultPosition[] = await Promise.all(
  vaults.map(async (v) => {
    const rawAddr: string =
      v.tokenAddress ||
      (v as any).poolAddress ||
      (v as any).contractAddress ||
      ''

    if (!rawAddr) return v

    const addr = rawAddr.toLowerCase()

    let creator: string | null = null
    try {
creator = await resolveCreatorAddress(addr)
    } catch {
      creator = null
    }

    return {
      ...v,
      creatorAddress: creator,
    }
  }),
)







    const portfolio = {
      mock: false,
      address: wallet,
      totalValueUsd,
      balances: {
        nativeInk,
        stables: stablesUsd,
        lpTokens: 0,
      },
      vaults: enrichedVaults,
      vaultDepositsUsd,
      unclaimedYieldUsd: 0,
      tokens: spotTokens,
    };

    return NextResponse.json(portfolio);

  } catch (err) {
    console.error('api/portfolio fatal error', err);
    return NextResponse.json(
      { error: 'internal portfolio error' },
      { status: 500 },
    );
  }
}