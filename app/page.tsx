// app/page.tsx

"use client";

import { useState, useEffect, useMemo } from "react";
import {
  HomeIcon,
  ArrowsRightLeftIcon,
  PresentationChartBarIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  InformationCircleIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
  ChartBarIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

import PreloadPlatformIcons from "./PreloadPlatformIcons";
import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { EnvelopeIcon } from "@heroicons/react/24/outline";
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import SwapPanel from './SwapPanel'
import InkMetricsLayout from './InkMetricsLayout'
import NoWalletOverlay from './components/home/NoWalletOverlay'
import EcosystemGrid from './components/ecosystem/EcosystemGrid'
import { inkEcosystem } from './data/ink-ecosystem'
import ExploreDashboard from './components/explore/ExploreDashboard'
import { getProtocolByAddress, getPositionUrl } from '@/lib/protocolRegistry'
import { getProtocolByName } from '@/lib/positionProtocolNameMap'


function getFavicon(url: string | null): string | null {
  if (!url) return null;
  try {
    const origin = new URL(url).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return null;
  }
}

const BLOCKSCOUT_BASE = 'https://explorer.inkonchain.com/api/v2';

async function resolveInkDomain(name: string): Promise<string | null> {
  const query = name.trim().toLowerCase();
  if (!query.endsWith('.ink')) return null;

  try {
    const res = await fetch(
      `${BLOCKSCOUT_BASE}/search?q=${encodeURIComponent(query)}`
    );

    if (!res.ok) {
      console.error('ink domain search failed', res.status);
      return null;
    }

    const data: any = await res.json();

    let items: any[] = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (Array.isArray(data.items)) {
      items = data.items;
    } else if (Array.isArray((data as any).results)) {
      items = (data as any).results;
    }

    const pickAddress = (item: any): string | null => {
      const candidates: string[] = [];

      ['address_hash', 'hash', 'address', 'addressHash', 'addr'].forEach(k => {
        const v = item?.[k];
        if (typeof v === 'string') candidates.push(v);
      });

      Object.values(item || {}).forEach(v => {
        if (typeof v === 'string') candidates.push(v);
      });

      for (const v of candidates) {
        if (v.startsWith('0x') && v.length === 42) {
          return v.toLowerCase();
        }
      }
      return null;
    };

    for (const it of items) {
      const type = String(
        it.resource_type || it.type || it.kind || ''
      ).toLowerCase();

      if (!type || type.includes('address') || type.includes('account')) {
        const addr = pickAddress(it);
        if (addr) return addr;
      }
    }

    for (const it of items) {
      const addr = pickAddress(it);
      if (addr) return addr;
    }

    return null;
  } catch (e) {
    console.error('resolveInkDomain crashed', e);
    return null;
  }
}


// svg footer - step style X icon
const TwitterIconSvg = () => (
  <svg
    width="18"
    height="16"
    viewBox="0 0 18 16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M13.6582 0.6875H16.1191L10.7051 6.91016L17.1035 15.3125H11.3125L8.17383 10.2148L3.70898 15.3125H1.21289L6.70312 8.96875L0.896484 0.6875H6.0293L8.9082 5.05859L13.6582 0.6875ZM12.7793 13.8359H14.1504L5.29102 2.09375H3.81445L12.7793 13.8359Z"
      fill="#9498A1"
    />
  </svg>
);

// tiny svg button for pin
const PinToggleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width="18"
    height="18"
  >
    <rect
      x="3.5"
      y="4"
      width="17"
      height="16"
      rx="4"
      ry="4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <line
      x1="12"
      y1="5"
      x2="12"
      y2="19"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
    <circle cx="8.2" cy="9" r="0.9" fill="currentColor" />
    <circle cx="8.2" cy="15" r="0.9" fill="currentColor" />
  </svg>
);

const RefreshIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10M1 14l5.36 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const pathToPage = (path: string): PageKey => {
  const p = (path || '').toLowerCase()

  if (p === '/' || p === '/home') return 'Home'

  if (p.startsWith('/bridge') || p.startsWith('/swap')) return 'Bridge'
if (p.startsWith('/metrics') || p.startsWith('/ink')) return 'Metrics'
  if (p.startsWith('/ecosystem')) return 'Ecosystem'
  if (p.startsWith('/explore')) return 'Explore'
  if (p.startsWith('/language')) return 'Language'

  return 'Home'
}

const pageToPath = (k: PageKey): string => {
  if (k === 'Home') return '/'
  if (k === 'Bridge') return '/bridge'
if (k === 'Metrics') return '/metrics'
  if (k === 'Ecosystem') return '/ecosystem'
  if (k === 'Explore') return '/explore'
  if (k === 'Language') return '/language'
  return '/'
}

type PageKey = 'Home' | 'Bridge' | 'Metrics' | 'Ecosystem' | 'Explore' | 'Language'

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
    token0IconUrl?: string
    token1IconUrl?: string
  };
};



type HistoryRange = "24H" | "1W" | "1M";

type PositionsTab = "wallet" | "yielding" | "nfts" | "transactions";

type HistoryPoint = {
  t: number; // timestamp in ms
  v: number; // usd value
};

type NftToken = {
  contract: string;
  tokenId: string;
  name: string;
  imageUrl?: string;
};

type NftCollection = {
  address: string;
  name: string;
  symbol: string;
  ownedCount: number;
  tokens: NftToken[];
};

type TxToken = {
  symbol: string;
  address: string;
};

type TxItem = {
  hash: string;
  timestamp: number;
  direction: "in" | "out" | "self";
  from: string;
  to: string;
  otherParty: string;
  valueInk: number;
  gasFeeInk: number;
  gasFeeUsd: number;
  details: string;
  hasNft: boolean;
  status: string;
  tokens: TxToken[];
  method?: string;
  toLabel?: string;

  // new fields from "Called function XYZ on contract Foo"
  primaryAppAddress?: string;
  primaryAppLabel?: string;
};

type GmStats = {
  totalGms: number | null;
  rank: string | null;
  streak: number | null;
  verified: boolean;
  loading: boolean;
  error: string | null;
};



function isSpamToken(t: TokenHolding): boolean {
  const price = t.priceUsd ?? 0;
  const value = t.valueUsd ?? price * t.balance;

  // if it has real value, keep it
  if (value >= 0.01) return false;

  const sym = (t.symbol || "").toLowerCase();

  const looksLikeLink =
    sym.includes("http") ||
    sym.includes(".com") ||
    sym.includes(".org") ||
    sym.includes(".net") ||
    sym.includes(".io");

  const looksLikeBot =
    sym.includes("bot") ||
    sym.includes("telegram") ||
    sym.includes("tg ") ||
    sym.includes("@");

  const veryLongSymbol = sym.length > 24;

  // zero value and looks shady
  if (!price && (looksLikeLink || looksLikeBot || veryLongSymbol)) {
    return true;
  }

  return false;
}

function isSpamSymbol(sym?: string): boolean {
  if (!sym) return false
  const s = sym.toLowerCase()

  const looksLikeLink =
    s.includes('http') ||
    s.includes('.com') ||
    s.includes('.org') ||
    s.includes('.net') ||
    s.includes('.io')

  const looksLikeBot =
    s.includes('bot') ||
    s.includes('telegram') ||
    s.includes('tg ') ||
    s.includes('@')

  const veryLongSymbol = s.length > 24

  return looksLikeLink || looksLikeBot || veryLongSymbol
}

function shortAddress(addr: string) {
  if (!addr) return ''
  const a = addr.toLowerCase()
  if (a.length <= 10) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}



function formatDateTimeLabel(t: number) {
  const d = new Date(t);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAddress(addr: string) {
  if (!addr) return "";
  if (addr.length <= 14) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatLastUpdated(ts: number | null): string {
  if (!ts) return "";
  const diffSec = Math.floor((Date.now() - ts) / 1000);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec} seconds ago`;

  const mins = Math.floor(diffSec / 60);
  if (mins < 60) {
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  }

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatNumber(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '0'

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function formatUsd(value: number, decimals: number = 2): string {
  return '$' + formatNumber(value, decimals)
}

function formatAmount(value: number, decimals: number = 4): string {
  return formatNumber(value, decimals)
}

type PortfolioResponse = {
  mock: boolean;
  address: string;
  nativeUsdPrice?: number;
  totalValueUsd: number;
  balances: {
    nativeInk: number;
    stables: number;
    lpTokens: number;
  };
  vaults: any[];
  vaultDepositsUsd: number;
  unclaimedYieldUsd: number;
  tokens: TokenHolding[];
};

type TxLeg = {
  direction: "in" | "out"; // in = received, out = sent
  amount: number | null;
  symbol: string;
};

function parseTxDetails(details: string | undefined): TxLeg[] {
  if (!details) return [];

  const legs: TxLeg[] = [];

  // fungible tokens  Sent 0.1 ANITA
  const reFungible = /(Sent|Received)\s+([\d.,]+)\s+([A-Za-z0-9]+)\b/g;
  let m: RegExpExecArray | null;

  while ((m = reFungible.exec(details)) !== null) {
    const dir = m[1] === "Sent" ? "out" : "in";
    const amt = parseFloat(m[2].replace(/,/g, ""));
    const sym = m[3];
    legs.push({
      direction: dir,
      amount: Number.isFinite(amt) ? amt : null,
      symbol: sym,
    });
  }

  // nfts  Sent INKBunnies #1234  Received BOI #7
  const reNft = /(Sent|Received)\s+([A-Za-z0-9]+)\s+#(\d+)/g;

  while ((m = reNft.exec(details)) !== null) {
    const dir = m[1] === "Sent" ? "out" : "in";
    const collection = m[2];
    const id = m[3];

    legs.push({
      direction: dir,
      amount: 1,
      symbol: `${collection} #${id}`,
    });
  }

  return legs;
}


function isValidContactInfo(input: string): boolean {
  const s = input.trim()
  if (!s) return false

  // twitter handle style: @name
  if (s.startsWith('@') && s.length >= 3) return true

  // simple email check: something@something.xxx
  const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
  if (emailRe.test(s)) return true

  return false
}



export default function HomePage() {
const [activePage, setActivePage] = useState<PageKey>(() => {
  if (typeof window === 'undefined') return 'Home'
  return pathToPage(window.location.pathname || '/')
})
  const [isPinned, setIsPinned] = useState(false);
const [theme, setTheme] = useState<'light' | 'dark'>(() => {
  if (typeof window === 'undefined') return 'light'

  
  const stored = window.localStorage.getItem('ink-theme')
  if (stored === 'light' || stored === 'dark') return stored

  return 'light'
})

// Theme
const [mounted, setMounted] = useState(false)

useEffect(() => {
  if (typeof window === 'undefined') return

  const stored = window.localStorage.getItem('ink-theme')
  if (stored === 'light' || stored === 'dark') {
    setTheme(stored)
  }

  setMounted(true) // mark as mounted AFTER we read storage
}, [])

  // real wallet and search input
const [walletAddress, setWalletAddress] = useState<string>('')   // currently viewed wallet
const [searchInput, setSearchInput] = useState<string>('')

// wagmi wallet state
const { address } = useAccount()
const { connect, connectors, isPending: isConnectPending } = useConnect()
const { disconnect } = useDisconnect()

const connectedWallet = address ? address.toLowerCase() : null
const isConnectingWallet = isConnectPending

const [ensName, setEnsName] = useState<string | null>(null);
const [connectedEnsName, setConnectedEnsName] = useState<string | null>(null);

  // portfolio + loading state
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [portfolioError, setPortfolioError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

    // positions (yielding) state
  const [positions, setPositions] = useState<any[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);

const [walletCopied, setWalletCopied] = useState(false);
const [txCopiedKey, setTxCopiedKey] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

// feedback
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'feature' | 'bug' | 'idea' | 'other' | 'contact'>('feature');
  const [feedbackContact, setFeedbackContact] = useState('');
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const isContactMode = feedbackCategory === 'contact';
  const contactIsValid = !isContactMode || isValidContactInfo(feedbackContact);

  // icons from Dexscreener keyed by token address
const [tokenIcons, setTokenIcons] = useState<{ [addr: string]: string }>({})
const [txPlatformIcons, setTxPlatformIcons] = useState<{ [addr: string]: string }>({})

  // history range and data
  const [historyRange, setHistoryRange] = useState<HistoryRange>("24H");
  const [netWorthHistory, setNetWorthHistory] = useState<HistoryPoint[]>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [positionsTab, setPositionsTab] = useState<PositionsTab>("wallet");
  const showSkeleton = isLoadingPortfolio && !portfolio;

const [nftCollections, setNftCollections] = useState<NftCollection[] | null>(
  null
);
const [perCollectionSpentUsd, setPerCollectionSpentUsd] =
  useState<Record<string, number>>({});
const [perCollectionFloorUsd, setPerCollectionFloorUsd] =
  useState<Record<string, number>>({});

  

// total spent across all collections (for later if you want to display it)
const [totalNftSpentUsd, setTotalNftSpentUsd] = useState<number>(0);

const [isLoadingNfts, setIsLoadingNfts] = useState(false);
const [nftError, setNftError] = useState<string | null>(null);
const [nftSortBy, setNftSortBy] = useState<"balance" | "spent" | null>(null);
const [nftSortDir, setNftSortDir] = useState<"asc" | "desc">("desc");

 // transactions consts
const [txs, setTxs] = useState<TxItem[]>([]);
const [isLoadingTxs, setIsLoadingTxs] = useState(false);
const [txError, setTxError] = useState<string | null>(null);
const [txTokenQuery, setTxTokenQuery] = useState<string>("");
const [txSelectedToken, setTxSelectedToken] = useState<TxToken | null>(null);
const [txPage, setTxPage] = useState(1);
const [txHasMore, setTxHasMore] = useState(false);
const [txTokenDropdownOpen, setTxTokenDropdownOpen] = useState(false);

const [txTokenOptions, setTxTokenOptions] = useState<TxToken[]>([]);

const [nativeUsdPrice, setNativeUsdPrice] = useState(0);

const [gmStats, setGmStats] = useState<GmStats>({
  totalGms: null,
  rank: null,
  streak: null,
  verified: false,
  loading: false,
  error: null,
});

const [showQrModal, setShowQrModal] = useState(false);

const [overlayDismissed, setOverlayDismissed] = useState(false)


useEffect(() => {
  if (typeof window === 'undefined') return

  const sync = () => {
    setActivePage(pathToPage(window.location.pathname || '/'))
  }

  // back/forward
  window.addEventListener('popstate', sync)

  // also react to pushState/replaceState from anywhere
const origPush: History['pushState'] = history.pushState.bind(history)
const origReplace: History['replaceState'] = history.replaceState.bind(history)


history.pushState = (
  data: any,
  unused: string,
  url?: string | URL | null
) => {
  origPush(data, unused, url)
  window.dispatchEvent(new Event('popstate'))
}

history.replaceState = (
  data: any,
  unused: string,
  url?: string | URL | null
) => {
  origReplace(data, unused, url)
  window.dispatchEvent(new Event('popstate'))
}



  // initial sync
  sync()

  return () => {
    window.removeEventListener('popstate', sync)
    history.pushState = origPush
    history.replaceState = origReplace
  }
}, [])


useEffect(() => {
  if (!address) return

  const addr = address.toLowerCase()

  // set default viewed wallet if empty
  setWalletAddress(prev => prev || addr)
  setSearchInput(prev => prev || addr)

  // register for hourly tracking
  ;(async () => {
    try {
      await fetch('/api/tracked-wallet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: addr }),
      })
    } catch (err) {
      console.error('tracked-wallet call failed', err)
    }
  })()
}, [address])

// try to get token icon from backend that proxies Dexscreener
const fetchDexIcon = async (address: string) => {
  if (!address) return;

  const key = address.toLowerCase();
  if (tokenIcons[key]) return;

  try {
    const res = await fetch(
      `/api/token-icon?address=${encodeURIComponent(address)}`
    );


    if (!res.ok) {
      console.error('token-icon api failed', res.status);
      return;
    }

    const data: { iconUrl?: string | null } = await res.json();

    if (!data.iconUrl) return;

    const icon = data.iconUrl as string;

    setTokenIcons(prev =>
      prev[key] ? prev : { ...prev, [key]: icon }
    );

  } catch (e) {
    console.error('token-icon api crashed', e);
  }
};


// fetch NFT icon from Blockscout
const fetchNftIcon = async (address: string) => {
  if (!address) return;

  const key = address.toLowerCase();
  if (tokenIcons[key]) return;

  try {
    const res = await fetch(
      `/api/nft-icon?address=${encodeURIComponent(address)}`
    );

    if (!res.ok) {
      console.error('nft-icon api failed', res.status);
      return;
    }

    const data: { iconUrl?: string | null } = await res.json();
    if (!data.iconUrl) return;

    setTokenIcons(prev =>
      prev[key] ? prev : { ...prev, [key]: data.iconUrl as string }
    );
  } catch (e) {
    console.error('nft-icon api crashed', e);
  }
};



const handleOverlayConnect = () => {
  const connector = connectors[0]
  if (!connector) return
  connect({ connector })
}

const handleOverlayGoMetrics = () => {
go('Metrics')
}


// central fetcher used by both auto load and manual refresh
const loadPortfolio = async (
  addr: string
): Promise<PortfolioResponse | null> => {
  if (!addr) return null;

  try {
    setIsLoadingPortfolio(true);
    setPortfolioError(null);

    setIsLoadingPositions(true);
    setPositionsError(null);

    const res = await fetch(`/api/portfolio?wallet=${addr}`);
    if (!res.ok) throw new Error(`status ${res.status}`);

const data: PortfolioResponse = await res.json();

// set positions first so poolTokenAddresses is ready before walletTokens renders
setPositions(Array.isArray((data as any).positions) ? (data as any).positions : [])
setPositionsError(null)

setPortfolio(data)

      setPositionsError(null)



// try to fetch icons from Dexscreener for tokens missing iconUrl
if (data?.tokens?.length) {
  data.tokens.forEach((t) => {
    if (!t.address) return;
    if (t.iconUrl) return;

    const key = t.address.toLowerCase();
    if (tokenIcons[key]) return;

    fetchDexIcon(t.address);
  });
}




    return data;
  } catch (err) {
    console.error("portfolio fetch failed", err);
    setPortfolioError("could not load portfolio");
    return null;
  } finally {
    setIsLoadingPortfolio(false);
    setIsLoadingPositions(false);
  }

};


  // load history from backend with range
  const loadHistory = async (addr: string, range: HistoryRange) => {
    if (!addr) return;

const rangeParam =
  range === "24H" ? "24h" : range === "1W" ? "1w" : "1m";

    try {
      const res = await fetch(
        `/api/history?wallet=${addr}&range=${rangeParam}`
      );
      if (!res.ok) {
        console.error("history fetch failed", res.status);
        return;
      }

      const json = await res.json();

      const arr = Array.isArray(json)
        ? json
        : Array.isArray((json as any).points)
        ? (json as any).points
        : [];

      const points: HistoryPoint[] = arr
        .map((p: any) => {
          const value = Number(
            p.value_usd ?? p.net_worth_usd ?? p.total_value_usd ?? 0
          );

          const ts = p.timestamp ?? p.taken_at ?? p.time ?? null;
          const t = ts ? new Date(ts).getTime() : Date.now();

          return { t, v: value };
        })
        .filter((p: HistoryPoint) => p.v >= 0);


      setNetWorthHistory(points);
      setHoverIndex(null);
    } catch (err) {
      console.error("history fetch crashed", err);
    }
  };

  // NFTS function

  const loadNfts = async (addr: string) => {
    if (!addr) return;

    try {
      setIsLoadingNfts(true);
      setNftError(null);

      const res = await fetch(`/api/nfts?wallet=${addr}`);
      if (!res.ok) throw new Error(`status ${res.status}`);

      const json = await res.json();
      const cols: NftCollection[] = Array.isArray(json.collections)
        ? json.collections
        : [];

      setNftCollections(cols);
    } catch (err) {
      console.error("nfts fetch failed", err);
      setNftError("could not load nfts");
      setNftCollections([]);
    } finally {
      setIsLoadingNfts(false);
    }
  };


    // total spent per collection is loaded from a separate endpoint
  const loadNftSpent = async (addr: string) => {
    if (!addr) return;

    try {
      const res = await fetch(`/api/nfts/spent?wallet=${addr}`);
      if (!res.ok) {
        console.error("nfts spent fetch failed", res.status);
        return;
      }

      const json = await res.json();

      const total = Number(json.totalSpentUsd || 0);
      const perCol = (json.perCollectionSpentUsd || {}) as Record<
        string,
        number
      >;

      setTotalNftSpentUsd(total);
      setPerCollectionSpentUsd(perCol);
    } catch (err) {
      console.error("nfts spent fetch crashed", err);
    }
  };

  // transaction function

// transaction function
const loadTransactions = async (addr: string, page: number) => {
  if (!addr) return;

  try {
    setIsLoadingTxs(true);
    setTxError(null);

    const params = new URLSearchParams();
    params.set('wallet', addr);
    params.set('page', String(page));

    // restore backend token filter
    const tokenAddr = txSelectedToken?.address?.toLowerCase();
    if (tokenAddr) {
      params.set('token', tokenAddr);
    }

    const res = await fetch(`/api/transactions?${params.toString()}`);

    if (!res.ok) throw new Error(`status ${res.status}`);

    const json = await res.json();
    const list: TxItem[] = Array.isArray(json.txs) ? json.txs : [];

    setTxHasMore(!!json.hasMore);

    // new: store native usd price coming from api
if (typeof json.nativeUsdPrice === 'number') {
  setNativeUsdPrice(json.nativeUsdPrice);
}


    setTxs(prev => (page === 1 ? list : [...prev, ...list]));

    if (Array.isArray(json.tokens)) {
      setTxTokenOptions(prev => {
        const map: Record<string, TxToken> = {};

        for (const t of [...prev, ...json.tokens]) {
          if (!t.address) continue;
          const addrKey = t.address.toLowerCase();
          if (!map[addrKey]) {
            map[addrKey] = {
              symbol: t.symbol,
              address: addrKey,
            };
          }
        }

        return Object.values(map);
      });
    }
  } catch (e) {
    console.error('loadTransactions failed', e);
    setTxError('could not load transactions');
  } finally {
    setIsLoadingTxs(false);
  }
};

// when wallet changes, reset tx state and hydrate from cache if present
useEffect(() => {
  if (!walletAddress) return;

  setTxPage(1);
  setTxHasMore(false);
  setTxTokenQuery('');
  setTxSelectedToken(null);
  setTxTokenDropdownOpen(false);
  setTxTokenOptions([]);

  // try to load cached txs for this wallet
  if (typeof window !== 'undefined') {
    try {
      const key = `inkdash_txs_${walletAddress.toLowerCase()}`;
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed: TxItem[] = JSON.parse(raw);
        setTxs(parsed);
      } else {
        setTxs([]);
      }
    } catch {
      setTxs([]);
    }
  } else {
    setTxs([]);
  }

loadPortfolio(walletAddress);
loadHistory(walletAddress, historyRange);
loadNfts(walletAddress);
loadNftSpent(walletAddress);
}, [walletAddress]);



// whenever wallet, page, or selected token changes, load tx page
useEffect(() => {
  if (!walletAddress) return;
  loadTransactions(walletAddress, txPage);
}, [walletAddress, txPage, txSelectedToken]);






useEffect(() => {
  let dead = false

  ;(async () => {
    // Prefetch Tokens Overview (no holders)
    try {
      const tokCached = (globalThis as any).__ink_tokens_overview_cache__
      if (!tokCached) {
        const r = await fetch('/api/explore/tokens-overview')
        const j = await r.json()
        if (dead) return
        const list = Array.isArray(j?.tokens) ? j.tokens : []
        ;(globalThis as any).__ink_tokens_overview_cache__ = list
      }
    } catch {}

    // Prefetch Top MCAP cards (stored where TopMcapCards already reads from)
    try {
      const key = 'ink_explore_top_mcap_cache_v1'
      if (typeof window !== 'undefined' && !sessionStorage.getItem(key)) {
        const r = await fetch('/api/explore/top-tokens-mcap')
        const j = await r.json()
        if (dead) return
        const rows = Array.isArray(j?.rows) ? j.rows : []
        sessionStorage.setItem(key, JSON.stringify(rows))
      }
    } catch {}
  })()

  return () => {
    dead = true
  }
}, [])


  // when range changes, reload history onlyy
  useEffect(() => {
    if (!walletAddress) return;
    loadHistory(walletAddress, historyRange);
  }, [historyRange, walletAddress]);

  // GM metrics from gm.inkonchain.com
useEffect(() => {
if (!walletAddress) {
  setGmStats({
    totalGms: null,
    rank: null,
    streak: null,
    verified: false,
    loading: false,
    error: null,
  });
  return;
}


  const addr = walletAddress.toLowerCase();

  const fetchGm = async () => {
    try {
      setGmStats(prev => ({
        ...prev,
        loading: true,
        error: null,
      }));

const res = await fetch(
  `/api/gm-metrics?wallet=${addr}`
);


      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }

      const json = await res.json();
      const user = json?.user || {};

      const sent =
        typeof user.sent === 'number' ? user.sent : null;
      const rank =
        typeof user.rank === 'string' ? user.rank : null;

      const streakRaw =
        typeof user.streakCurrent === 'number'
          ? user.streakCurrent
          : typeof user.streak === 'number'
          ? user.streak
          : null;

      const verified = !!user.verified;

      setGmStats({
        totalGms: sent,
        rank,
        streak: streakRaw,
        verified,
        loading: false,
        error: null,
      });

    } catch (err) {
      console.error("gm fetch failed", err);
      setGmStats({
        totalGms: null,
        rank: null,
        streak: null,
        verified: false,
        loading: false,
        error: 'gm data unavailable',
      });
    }
  };

  fetchGm();
}, [walletAddress]);

// fetch .ink name for the current wallet from Blockscout
useEffect(() => {
  if (!walletAddress) {
    setEnsName(null);
    return;
  }

  const addr = walletAddress.toLowerCase();
  let cancelled = false;

  const fetchInkName = async () => {
    try {
      const res = await fetch(
        `https://explorer.inkonchain.com/api/v2/addresses/${addr}`
      );

      if (!res.ok) return;

      const data = await res.json();

      const nameField =
        typeof data.ens_domain_name === "string" && data.ens_domain_name.length
          ? data.ens_domain_name
          : typeof data.name === "string" && data.name.length
          ? data.name
          : null;

      if (!cancelled) {
        setEnsName(nameField);
      }
    } catch {
      if (!cancelled) {
        setEnsName(null);
      }
    }
  };

  fetchInkName();

  return () => {
    cancelled = true;
  };
}, [walletAddress]);

// fetch .ink name for the connected wallet (button label)
useEffect(() => {
  if (!connectedWallet) {
    setConnectedEnsName(null);
    return;
  }

  
  
  const addr = connectedWallet.toLowerCase();
  let cancelled = false;

  const fetchInkName = async () => {
    try {
      const res = await fetch(
        `https://explorer.inkonchain.com/api/v2/addresses/${addr}`
      );

      if (!res.ok) return;

      const data = await res.json();

      const nameField =
        typeof data.ens_domain_name === 'string' && data.ens_domain_name.length
          ? data.ens_domain_name
          : typeof data.name === 'string' && data.name.length
          ? data.name
          : null;

      if (!cancelled) {
        setConnectedEnsName(nameField);
      }
    } catch {
      if (!cancelled) {
        setConnectedEnsName(null);
      }
    }
  };

  fetchInkName();

  return () => {
    cancelled = true;
  };
}, [connectedWallet]);


const handleDisconnect = () => {
  disconnect()

  setWalletAddress('')
  setSearchInput('')
  setPortfolio(null)

  setNetWorthHistory([])
  setHoverIndex(null)

  setTxs([])
  setTxPage(1)
  setTxHasMore(false)
  setTxSelectedToken(null)
  setTxTokenQuery('')

  setNftCollections(null)
  setPerCollectionSpentUsd({})
  setTotalNftSpentUsd(0)
  setOverlayDismissed(false)
}

const go = (k: PageKey) => {
  setActivePage(k)

  if (typeof window === 'undefined') return

  const nextPath = pageToPath(k)
  const curPath = window.location.pathname

  if (curPath !== nextPath) {
    window.history.pushState({}, '', nextPath)
  }
}


  // manual refresh: refresh portfolio, write snapshot, reload history
const refreshAll = async (addrOverride?: string) => {
  const addr = addrOverride || walletAddress;
  if (!addr) return;

  try {
    setIsRefreshing(true);

    const data = await loadPortfolio(addr);
    if (!data) return;

    const netWorth = data.totalValueUsd ?? 0;

    const res = await fetch('/api/snapshot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        wallet: addr,
        netWorthUsd: netWorth,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      console.error('snapshot failed', res.status, errJson);
    }

    await loadHistory(addr, historyRange);
  } catch (err) {
    console.error('refresh failed', err);
  } finally {
    setIsRefreshing(false);
  }
};


  const changeHistoryRange = (range: HistoryRange) => {
    setHistoryRange(range);
  };


// use first point in current range as baseline
const latestPoint =
  netWorthHistory.length > 0
    ? netWorthHistory[netWorthHistory.length - 1]
    : null;

const firstPoint =
  netWorthHistory.length > 0 ? netWorthHistory[0] : null;

const latest =
  latestPoint?.v ?? portfolio?.totalValueUsd ?? 0;

const base = firstPoint?.v ?? latest;

// dollar change over the whole range, for example 1000 → 1050 gives +50
const changeAbs = latest - base;

// percent change over the whole range, for example 1000 → 1050 gives +5
const changePct =
  base === 0 ? 0 : ((latest - base) / base) * 100;

// chart up or down uses full range change now
const isUp = changePct >= 0;

const currentValue = latest;
const hasHistory = netWorthHistory.length > 1;



  let linePoints = "";
  let fillPoints = "";
  let hoverX: number | null = null;
  let hoverY: number | null = null;

  const values = netWorthHistory.map((p) => p.v);

  if (values.length > 1) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    linePoints = netWorthHistory
      .map((p, i) => {
        const x =
          netWorthHistory.length === 1
            ? 0
            : (i / (netWorthHistory.length - 1)) * 100;
        const y = 38 - ((p.v - min) / range) * 28;

        if (hoverIndex === i) {
          hoverX = x;
          hoverY = y;
        }

        return `${x},${y}`;
      })
      .join(" ");

    fillPoints = `0,40 ${linePoints} 100,40`;

    // if nothing hovered yet, snap helper to last point
    if (hoverX == null && netWorthHistory.length > 0) {
      const lastIndex = netWorthHistory.length - 1;
      const lastValue = netWorthHistory[lastIndex].v;
      const x =
        netWorthHistory.length === 1
          ? 0
          : (lastIndex / (netWorthHistory.length - 1)) * 100;
      const y = 38 - ((lastValue - min) / range) * 28;
      hoverX = x;
      hoverY = y;
    }
  } else {
    linePoints = "";
    fillPoints = "0,40 100,40 0,40";
  }


const activePoint =
  hoverIndex != null && netWorthHistory[hoverIndex]
    ? netWorthHistory[hoverIndex]
    : null;


  // theme to body
useEffect(() => {
  if (typeof document === 'undefined') return
  document.body.dataset.theme = theme
}, [theme])




const toggleTheme = () => {
  setTheme(prev => {
    const next = prev === 'light' ? 'dark' : 'light'
    if (typeof document !== 'undefined') {
      document.body.dataset.theme = next

      // theme switch
      document.body.classList.add('theme-switching')
      window.setTimeout(() => {
        document.body.classList.remove('theme-switching')
      }, 120)
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('ink-theme', next)
    }
    return next
  })
}




  const sidebarClass = isPinned
    ? "sidebar sidebar-pinned"
    : "sidebar sidebar-floating";

  const mainClass = isPinned ? "main main-pinned" : "main main-floating";

  
const pageTitles: Record<PageKey, string> = {
  Home: 'Ink Dashboard',
  Bridge: 'Bridge',
  Metrics: 'Metrics',
  Ecosystem: 'Ecosystem',
  Explore: 'Explore',
  Language: 'Language',
}

const pageSubtitles: Record<PageKey, string> = {
  Home: 'simple overview of your ink portfolio',
  Bridge: 'swap & bridge to ink',
Metrics: 'simple overview of ink network metrics',
  Ecosystem: 'apps and protocols',
  Explore: 'token discovery and wallet tracking',
  Language: 'language',
}




const walletUsd = (portfolio as any)?.walletValueUsd ?? 0;
const netWorthUsd = portfolio?.totalValueUsd ?? 0;

const yieldingUsd = Array.isArray(positions)
  ? positions.reduce((sum, p: any) => {
      const dep = Number(p?.depositedUsd || 0)
      const rew = Number(p?.rewardsUsd || 0)
      return sum + (Number.isFinite(dep) ? dep : 0) + (Number.isFinite(rew) ? rew : 0)
    }, 0)
  : 0;

// net worth if you need it anywhere
const totalValue = walletUsd + yieldingUsd;



   const nftCount = nftCollections
    ? nftCollections.reduce(
        (sum, c) => sum + (c.ownedCount || c.tokens.length || 0),
        0
      )
    : 0;

const sortedNfts = useMemo(() => {
  if (!nftCollections) return [];

  const arr = [...nftCollections];

  if (nftSortBy === "balance") {
    arr.sort((a, b) => {
      const aBal = a.ownedCount || a.tokens.length || 0;
      const bBal = b.ownedCount || b.tokens.length || 0;
      return aBal - bBal;
    });
  } else if (nftSortBy === "spent") {
    arr.sort((a, b) => {
      const aSpent = perCollectionSpentUsd[a.address] || 0;
      const bSpent = perCollectionSpentUsd[b.address] || 0;
      return aSpent - bSpent;
    });
  }

  if (nftSortDir === "desc") arr.reverse();
  return arr;
}, [nftCollections, nftSortBy, nftSortDir, perCollectionSpentUsd]);

const handleNftSort = (key: "balance" | "spent") => {
  if (nftSortBy === key) {
    setNftSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
  } else {
    setNftSortBy(key);
    setNftSortDir("desc");
  }
};


const visibleTokens = portfolio
  ? portfolio.tokens.filter((t) => !isSpamToken(t))
  : [];

  const poolTokenAddresses = useMemo(() => {
  const s = new Set<string>()
  for (const p of (Array.isArray(positions) ? positions : [])) {
    if (p && p.lpBreakdown && typeof p.tokenAddress === 'string') {
      s.add(p.tokenAddress.toLowerCase())
    }
  }
  return s
}, [positions])


const walletTokens = portfolio
  ? (() => {
      // start with normal tokens
      let rows: TokenHolding[] = [...visibleTokens]

      // remove pool tokens that also exist in Positions tab
      rows = rows.filter((t) => {
        const a = String(t.address || '').toLowerCase()
        if (!a || a === 'native-ink') return true
        return !poolTokenAddresses.has(a)
      })

      // add native ETH on top
      const nativeBal = portfolio.balances?.nativeInk ?? 0
      const nativePrice = nativeUsdPrice || 0

      if (nativeBal > 0) {
        rows.unshift({
          address: 'native-ink',
          symbol: 'ETH',
          decimals: 18,
          rawBalance: nativeBal.toString(),
          balance: nativeBal,
          priceUsd: nativePrice || undefined,
          valueUsd: nativePrice ? nativeBal * nativePrice : undefined,
          iconUrl: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
        })
      }

      return rows
    })()
  : []

// auto detect LP / vault style tokens and treat them as yielding positions
const yieldingPositions = useMemo(() => {
  return Array.isArray(positions) ? positions : [];
}, [positions]);

const yieldingByProtocol = useMemo(() => {
  if (!yieldingPositions.length) return [];

  type GroupItem = {
    v: any;
    positionType: 'Liquidity pool' | 'Staked' | 'Vault' | 'Other';
  };

  type Group = {
    key: string;
    protocolLabel: string;
    protocolUrl: string | null;
    creatorAddr: string | null;
    finalIconSrc: string;
    items: GroupItem[];
  };

  const groupsByKey: Record<string, Group> = {};

  for (const v of yieldingPositions as any[]) {
    const platform = v.protocol || 'unknown';

    const creatorAddr = (((v.factoryAddress as string) || (v.creatorAddress as string) || '')).toLowerCase();
    const rawLabel = v.poolName || v.name || v.symbol || '';

const protoFromCreator = creatorAddr ? getProtocolByAddress(creatorAddr) : null

const protoLabel = creatorAddr
  ? (protoFromCreator?.label || shortAddress(creatorAddr))
  : platform



    const upperSym = (v.symbol || '').toUpperCase();
    const upperPool = (rawLabel || '').toUpperCase();

    let positionType: GroupItem['positionType'] = 'Other';

    if (v.lpBreakdown) {
      positionType = 'Liquidity pool';
    } else if (
      upperPool.includes('VAULT') ||
      upperPool.includes('HYDRO') ||
      upperPool.includes('DCA')
    ) {
      positionType = 'Vault';
    } else if (
      upperSym.includes('STK') ||
      upperPool.includes('STAKED')
    ) {
      positionType = 'Staked';
    } else {
      positionType = 'Other';
    }


const addrKey = (
  (v.tokenAddress as string) ||
  (v.poolAddress as string) ||
  (v.contractAddress as string) ||
  ''
).toLowerCase()

const protoFromAddr = addrKey ? getProtocolByAddress(addrKey) : null

const protocolUrl =
  protoFromCreator?.url ||
  protoFromAddr?.url ||
  null





const faviconUrl = protocolUrl ? getFavicon(protocolUrl) : null


const manualIconKey =
  protoFromCreator?.icon || protoFromAddr?.icon || ''




    const manualIconSrc = manualIconKey
      ? `/platforms/${manualIconKey}.svg`
      : null;

    const finalIconSrc =
      faviconUrl ||
      manualIconSrc ||
      '/platforms/dapp.svg';

    const groupKey = creatorAddr || protoLabel || platform || 'Unknown';

    if (!groupsByKey[groupKey]) {
      groupsByKey[groupKey] = {
        key: groupKey,
        protocolLabel: protoLabel,
        protocolUrl,
        creatorAddr: creatorAddr || null,
        finalIconSrc,
        items: [],
      };
    }

    groupsByKey[groupKey].items.push({ v, positionType });
  }

  return Object.values(groupsByKey);
}, [yieldingPositions, portfolio]);

const isViewingConnectedWallet =
  !!connectedWallet &&
  !!walletAddress &&
  connectedWallet.toLowerCase() === walletAddress.toLowerCase();

const explorerTxUrl = walletAddress
  ? `https://explorer.inkonchain.com/address/${walletAddress}?tab=txs`
  : null;


// all unique tokens from transactions


  // fetch icons for tokens seen in transactions as well
  useEffect(() => {
    txTokenOptions.forEach((tok) => {
      if (!tok.address) return;

      const key = tok.address.toLowerCase();
      if (tokenIcons[key]) return;

      fetchDexIcon(tok.address);
    });
  }, [txTokenOptions, tokenIcons]);




// suggestions based on query
const txTokenSuggestions = useMemo(() => {
  const q = txTokenQuery.trim().toLowerCase();

  // no typing = no dropdown items
  if (!q) return [];

  return txTokenOptions.filter((tok) => {
    const sym = (tok.symbol || "").toLowerCase();
    const addr = (tok.address || "").toLowerCase();
    return sym.includes(q) || addr.includes(q);
  });
}, [txTokenOptions, txTokenQuery]);

const tokenPriceMap = useMemo(() => {
  const m: Record<string, number> = {};
  if (portfolio?.tokens) {
    portfolio.tokens.forEach((t) => {
      if (t.address && t.priceUsd != null) {
        m[t.address.toLowerCase()] = t.priceUsd;
      }
    });
  }
  return m;
}, [portfolio]);

const findTokenIconBySymbol = (sym: string): string | null => {
  if (!sym || !portfolio) return null;

  const upper = sym.toUpperCase();
  const match =
    portfolio.tokens.find(
      (t) => (t.symbol || '').toUpperCase() === upper
    ) || null;

  if (!match) return null;

  const addrKey = match.address?.toLowerCase();
  return (
    match.iconUrl ||
    (addrKey ? tokenIcons[addrKey] || null : null)
  );
};

// final filtered transactions
const filteredTxs = useMemo(() => {
  if (!txSelectedToken) return txs;

  const target = txSelectedToken.address.toLowerCase();
  return txs.filter(tx =>
    (tx.tokens || []).some(
      tok => tok.address && tok.address.toLowerCase() === target
    )
  );
}, [txs, txSelectedToken]);

// auto-load icons for tokens that appear only inside txs
useEffect(() => {
  filteredTxs.forEach(tx => {
    tx.tokens.forEach(t => {
      const addr = t.address?.toLowerCase();
      if (!addr || tokenIcons[addr]) return;

      const sym = (t.symbol || '').toUpperCase();
      const isNft = sym.includes('#');

      if (isNft) {
        fetchNftIcon(addr);
      } else {
        fetchDexIcon(addr);
      }
    });
  });
}, [filteredTxs, tokenIcons]);


// prefetch NFT icons for NFT tx legs (DO NOT do this in render)
useEffect(() => {
  filteredTxs.forEach(tx => {
    ;(tx.tokens || []).forEach(t => {
      const addr = (t.address || '').toLowerCase()
      if (!addr) return

      const sym = (t.symbol || '').toUpperCase()
      if (!sym.includes('#')) return

      // only if not cached
      if (tokenIcons[addr]) return
      fetchNftIcon(addr)
    })
  })
}, [filteredTxs, tokenIcons])


const showTxFullLoader = isLoadingTxs && txPage === 1;


return (
  <>
    {showQrModal && walletAddress && (
      <div
        className='qr-overlay'
        onClick={() => setShowQrModal(false)}
      >
        <div
          className='qr-modal'
          onClick={e => e.stopPropagation()}
        >
          <div className='qr-modal-header'>
            <button
              type='button'
              className='qr-close-btn'
              onClick={() => setShowQrModal(false)}
            >
              ×
            </button>
          </div>

          <div className='qr-modal-body'>
            <img
              className='qr-image'
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                walletAddress.toLowerCase()
              )}`}
              alt='wallet qr'
            />
            <div className='qr-address'>
              {walletAddress.toLowerCase()}
            </div>
          </div>
        </div>
      </div>
    )}

<PreloadPlatformIcons />
<link rel="preconnect" href="https://icons.llamao.fi" />
    {/* top header */}
    <header
    
        className={`header ${isPinned ? "header-pinned" : "header-floating"}`}
      >
<div className='header-left'>
  <div className='ink-built-pill'>
    <img
      src='/ink-logo-purple-white-icon.svg'
      alt='ink'
      className='ink-built-logo'
    />
    <span className='ink-built-text'>built on ink</span>
  </div>
</div>


        <div className="header-center">
          <div className="search-wrapper">
            <span className="search-icon">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <circle
                  cx="11"
                  cy="11"
                  r="7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  fill="none"
                />
                <line
                  x1="16"
                  y1="16"
                  x2="21"
                  y2="21"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </span>

            <input
              placeholder="Search Address or .INK Domain"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
onKeyDown={async (e) => {
  if (e.key !== 'Enter') return;

  e.preventDefault();

  const raw = (e.currentTarget as HTMLInputElement).value;
  const trimmed = raw.trim();
  if (!trimmed) return;

  let targetAddress = trimmed;

  // .ink domain case
  if (
    trimmed.toLowerCase().endsWith('.ink') &&
    !trimmed.toLowerCase().startsWith('0x')
  ) {
    const resolved = await resolveInkDomain(trimmed);

    if (!resolved) {
      alert('could not resolve this .ink domain');
      return;
    }

    targetAddress = resolved;
  }

  setSearchInput(trimmed);

  const sameWallet =
    walletAddress &&
    walletAddress.toLowerCase() === targetAddress.toLowerCase();

  setNetWorthHistory([]);
  setHoverIndex(null);

if (!sameWallet) {
  setWalletAddress(targetAddress);
}

await refreshAll(targetAddress);
loadNfts(targetAddress);
loadNftSpent(targetAddress);

}}
/>
          </div>
        </div>

        <div className="header-right">
<button
  type="button"
  className="theme-toggle-btn"
  onClick={toggleTheme}
>
  {!mounted
    ? '☾'                  // initial SSR + first client render
    : theme === 'light'
      ? '☾'
      : '☀'}
</button>


{mounted && connectedWallet ? (
  <button
    type='button'
    className='connect-wallet-btn'
    onClick={handleDisconnect}
  >
    {(connectedEnsName ||
      `${connectedWallet.substring(0, 6)}...${connectedWallet.substring(
        connectedWallet.length - 4
      )}`)} • disconnect
  </button>
) : (
  <button
    type='button'
    className='connect-wallet-btn'
    onClick={() => {
      const connector = connectors[0]
      if (!connector) {
        console.error('no wagmi connector found')
        return
      }
      connect({ connector })
    }}
  >
    {!mounted ? 'connect wallet' : isConnectingWallet ? 'connecting...' : 'connect wallet'}
  </button>
)}


        </div>
      </header>

      <div className="layout-shell">
        {/* sidebar */}
        <aside className={sidebarClass}>
          {/* logo + pin row */}
          <div className="sidebar-brand">
            <div className="sidebar-logo-wrapper">
<img src='/logo.png' alt='logo' className='sidebar-logo-img' />
              <span className="sidebar-app-name">Inkavern</span>
            </div>

            <button
              className="sidebar-pin-btn pin-in-brand"
              onClick={() => setIsPinned((prev) => !prev)}
            >
              <PinToggleIcon />
            </button>
          </div>

          {/* main nav items */}
<nav className="sidebar-nav">
  {/* Home */}
  <button
    className={`sidebar-item ${
      activePage === "Home" ? "sidebar-item-active" : ""
    }`}
    onClick={() => {
go('Home')

      if (
        connectedWallet &&
        walletAddress.toLowerCase() !== connectedWallet.toLowerCase()
      ) {
        setWalletAddress(connectedWallet);
        setSearchInput(connectedWallet);

        setNetWorthHistory([]);
        setHoverIndex(null);

        refreshAll(connectedWallet);
        loadNfts(connectedWallet);
        loadNftSpent(connectedWallet);
      }
    }}
  >
    
    
    <span className="sidebar-icon-slot">
      <span className="sidebar-icon">
        <HomeIcon />
      </span>
    </span>
    <span className="sidebar-label">Home</span>
  </button>

  {/* Swap */}
  <button
    className={`sidebar-item ${
      activePage === "Bridge" ? "sidebar-item-active" : ""
    }`}
onClick={() => go('Bridge')}
  >
    <span className="sidebar-icon-slot">
      <span className="sidebar-icon">
        <ArrowsRightLeftIcon />
      </span>
    </span>
    <span className="sidebar-label">Bridge</span>
  </button>

  {/* Explore */}
  <button
    className={`sidebar-item ${
      activePage === "Explore" ? "sidebar-item-active" : ""
    }`}
    onClick={() => go('Explore')}
  >
    <span className="sidebar-icon-slot">
      <span className="sidebar-icon">
        <MagnifyingGlassIcon />
      </span>
    </span>
    <span className="sidebar-label">Explore</span>
  </button>

{/* Metrics */}
<button
  className={`sidebar-item ${activePage === 'Metrics' ? 'sidebar-item-active' : ''}`}
  onClick={() => go('Metrics')}
>
  <span className='sidebar-icon-slot'>
    <span className="sidebar-icon">
      <PresentationChartBarIcon />
    </span>
  </span>
  <span className='sidebar-label'>Metrics</span>
</button>

{/* Ecosystem */}
<button
  className={`sidebar-item ${
    activePage === "Ecosystem" ? "sidebar-item-active" : ""
  }`}
  onClick={() => go('Ecosystem')}
>
  <span className="sidebar-icon-slot">
    <span className="sidebar-icon">
      <CubeIcon />
    </span>
  </span>
  <span className="sidebar-label">Ecosystem</span>
</button>


  {/* Language */}
  <button
    className={`sidebar-item ${
      activePage === "Language" ? "sidebar-item-active" : ""
    }`}
onClick={() => go('Language')}
  >
    <span className="sidebar-icon-slot">
      <span className="sidebar-icon">
        <GlobeAltIcon />
      </span>
    </span>
    <span className="sidebar-label">English</span>
  </button>
</nav>



<div className="sidebar-divider"></div>
{/* X button row above footer line */}
<div className="sidebar-social-row">

  <button
    className="sidebar-footer-twitter"
    onClick={() => window.open("https://x.com/inkavern", "_blank")}
  >
    <span className="sidebar-bottom-icon">
      <TwitterIconSvg />
    </span>
    <span className="sidebar-twitter-label">Follow Us</span>
  </button>

  <button
    className='sidebar-footer-feedback'
    onClick={() => {
      setFeedbackCategory('feature');
      setFeedbackMessage('');
      setFeedbackContact('');
      setFeedbackStatus('idle');
      setIsFeedbackOpen(true);
    }}
  >
    <span className='sidebar-bottom-icon'>
      <ChatBubbleLeftRightIcon width={16} height={16} />
    </span>
    <span className='sidebar-twitter-label'>feedback</span>
  </button>

  <button
    className='sidebar-footer-contact'
    onClick={() => {
      setFeedbackCategory('contact');
      setFeedbackMessage('');
      setFeedbackContact('');
      setFeedbackStatus('idle');
      setIsFeedbackOpen(true);
    }}
  >
    <span className='sidebar-bottom-icon'>
      <EnvelopeIcon width={16} height={16} />
    </span>
    <span className='sidebar-twitter-label'>contact us</span>
  </button>
</div>


{/* footer links + copyright */}
<div className="sidebar-footer">
  {/* text links (only when sidebar is open) */}
  <div className="sidebar-footer-links-row">
    <button className="sidebar-footer-link">About Us</button>
    <span className="sidebar-footer-dot">•</span>
    <button className="sidebar-footer-link">Terms of service</button>
  </div>

  {/* three dots (collapsed only) */}
  <button
    className="sidebar-footer-dots"
    aria-label="More info"
  >
    <span></span>
    <span></span>
    <span></span>
  </button>

  {/* copyright row (open = normal, collapsed = big C) */}
  <div className="sidebar-footer-copy">
    <span className="sidebar-footer-copy-symbol">©</span>
    <span className="sidebar-footer-copy-text">2025 Inkavern</span>
  </div>
</div>


        </aside>

        {/* main content */}
        <main className={mainClass}>
          <div className="main-inner">



<div className="main-header-row">
  <div>
    {activePage === 'Home' && (
      <h1 className="page-title">{pageTitles[activePage]}</h1>
    )}
    <p className="page-subtitle">{pageSubtitles[activePage]}</p>
  </div>


{activePage === 'Home' && (
  <div className="main-header-right">
    <span className="last-updated-text">
      {walletAddress && lastUpdatedAt
        ? `last updated ${formatLastUpdated(lastUpdatedAt)}`
        : walletAddress
        ? 'no data yet'
        : 'enter a wallet to start'}
    </span>

    <button
      className="refresh-round-btn"
      onClick={() => refreshAll()}
      disabled={isRefreshing || !walletAddress}
    >
      <span className={isRefreshing ? 'spin-refresh' : ''}>
        <RefreshIcon />
      </span>
    </button>
  </div>
)}
</div>

{activePage === 'Home' && (
  <div className="home-shell">
    <NoWalletOverlay
  show={!walletAddress && !overlayDismissed}
  onConnect={handleOverlayConnect}
  onGoMetrics={handleOverlayGoMetrics}
  onClose={() => setOverlayDismissed(true)}
/>

                      {/* portfolio header card */}
            <div
              className={`portfolio-header-card ${
                isUp ? "chart-up" : "chart-down"
              }`}
            >
              {isLoadingPortfolio && (
                <div className="portfolio-loading-overlay">
                  <div className="portfolio-loading-spinner" />
                  <span className="portfolio-loading-text">
                    loading wallet...
                  </span>
                </div>
              )}

              <div className="portfolio-header-grid">
                {/* left side: wallet identity + quick actions */}
                <div className="portfolio-meta">
                  <div className="wallet-identity">
                    <div className="wallet-label-row">
                      <span className="wallet-label">INK Wallet</span>
<span className="wallet-status-pill">
  {!mounted
    ? "Not connected"
    : isViewingConnectedWallet
    ? "Connected"
    : connectedWallet
    ? "Watching"
    : "Not connected"}
</span>


                    </div>
<div
  className={
    'wallet-address-row' + (walletCopied ? ' show-tooltip' : '')
  }
  onClick={async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress.toLowerCase());
    } catch (e) {
      console.error('clipboard failed', e);
    }
    setWalletCopied(true);
    setTimeout(() => setWalletCopied(false), 1200);
  }}
>
  {walletCopied && (
    <span className='wallet-copy-tooltip'>copied</span>
  )}


<span className="wallet-address-text">
  {walletAddress
    ? isViewingConnectedWallet
      ? "your wallet: "
      : "watching: "
    : "no wallet selected"}
{walletAddress && (
  <>
    {ensName || formatAddress(walletAddress)}
    <a
      href={`https://explorer.inkonchain.com/address/${walletAddress}`}
      target="_blank"
      rel="noopener noreferrer"
      className="wallet-explorer-link"
    >
      🔗
    </a>
  </>
)}

</span>

{walletAddress && (
  <div className="wallet-tools">
    {/* copy button */}
    <button
      type="button"
      className="wallet-copy-icon-btn"
      aria-label="Copy address"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(walletAddress.toLowerCase());
          setWalletCopied(true);
          setTimeout(() => setWalletCopied(false), 1200);
        } catch (err) {
          console.error("clipboard failed", err);
        }
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="9" width="11" height="11" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>

    {/* qr button */}
    <button
      type="button"
      className="wallet-qr-icon-btn"
      aria-label="Show QR"
      onClick={(e) => {
        e.stopPropagation();
        setShowQrModal(true);
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <path d="M14 14h3v3h-3z" />
        <path d="M19 19h2" />
      </svg>
    </button>
  </div>
)}

                    </div>
                  </div>
                  <div className="wallet-actions-row">
  <button
    type="button"
    className="wallet-action-btn"
onClick={() => go('Bridge')}
  >
    Swap & Bridge 
  </button>
</div>


                  {walletAddress && (
  <div className="gm-metrics-row">
    {gmStats.verified && (
      <div className="gm-badge">
        <span className="gm-badge-icon">🐙</span>
        <span className="gm-badge-text">Kraken Verified</span>
      </div>
    )}

<div className="gm-metrics-list">
  <div className="gm-metric">
    <span className="gm-metric-label">Total GMs</span>
    <span className="gm-metric-value">
      {gmStats.totalGms ?? '-'}
    </span>
  </div>

  <span className="gm-separator-dot">•</span>

  <div className="gm-metric">
    <span className="gm-metric-label">Rank</span>
    <span className="gm-metric-value">
      {gmStats.rank ?? '-'}
    </span>
  </div>

  <span className="gm-separator-dot">•</span>

<div className="gm-metric gm-streak" title={`${gmStats.streak} day streak`}>
  <span className="gm-metric-label">Streak</span>
  <span className="gm-metric-value">{gmStats.streak ?? "-"}</span>
</div>
</div>

  </div>
)}

                </div>

                {/* right side: net worth + chart */}
                <div className="portfolio-networth">
                  <div className="portfolio-title-row">
                    <div className="portfolio-title-left">
                      <span className="portfolio-title">Net worth</span>
                      <span className="portfolio-title-pill">ink only</span>
                    </div>

<div className="portfolio-range-switch">
  <button
    className={
      historyRange === "24H"
        ? "range-btn range-btn-active"
        : "range-btn"
    }
    onClick={() => changeHistoryRange("24H")}
  >
    24H
  </button>

  <button
    className={
      historyRange === "1W"
        ? "range-btn range-btn-active"
        : "range-btn"
    }
    onClick={() => changeHistoryRange("1W")}
  >
    1W
  </button>

  <button
    className={
      historyRange === "1M"
        ? "range-btn range-btn-active"
        : "range-btn"
    }
    onClick={() => changeHistoryRange("1M")}
  >
    1M
  </button>
</div>
                  </div>

  <div className="portfolio-tag-row">
    <div className="portfolio-tag-right">
      <span className="portfolio-tag-dot"></span>
      <span className="portfolio-tag-text">live snapshot</span>
    </div>
  </div>

                  <div className="portfolio-networth-main premium-networth">
    <div className="portfolio-chart-wrapper">
      <div className="portfolio-chart-bg"></div>
      {activePoint && hoverX != null && (
        <div
          className="chart-tooltip"
          style={{ left: `${hoverX}%` }}
        >
          <div className="chart-tooltip-inner">
            <div className="chart-tooltip-date">
              {formatDateTimeLabel(activePoint.t)}
            </div>
            <div className="chart-tooltip-row">
              <span className="chart-tooltip-dot-icon" />
              <span className="chart-tooltip-label">Net worth</span>
<span className='chart-tooltip-value'>
  {formatUsd(activePoint.v, 2)}
</span>
            </div>
          </div>
        </div>
      )}

      <div className="portfolio-chart">

<svg
  viewBox="0 0 100 50"
  preserveAspectRatio="none"
  className="chart-svg"
  onMouseLeave={() => setHoverIndex(null)}
  onMouseMove={(e) => {
    if (netWorthHistory.length < 2) return;
    const rect =
      (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const step =
      rect.width / (netWorthHistory.length - 1);
    const index = Math.round(x / step);
    const clamped = Math.max(
      0,
      Math.min(netWorthHistory.length - 1, index)
    );
    setHoverIndex(clamped);
  }}
>
  <defs>
    <linearGradient
      id="networthAreaGradient"
      x1="0"
      y1="0"
      x2="0"
      y2="1"
    >
      <stop offset="0" stopColor="currentColor" stopOpacity="0.26" />
      <stop offset="0.45" stopColor="currentColor" stopOpacity="0.12" />
      <stop offset="1" stopColor="currentColor" stopOpacity="0" />
    </linearGradient>
  </defs>

  <polygon
    className="portfolio-chart-fill"
    points={fillPoints}
    fill="url(#networthAreaGradient)"
  />

  <polyline
    className="portfolio-chart-line"
    points={linePoints}
  />

  {hoverX != null && hoverY != null && (
    <>
      <line
        className="chart-hover-line"
        x1={hoverX}
        x2={hoverX}
        y1={0}
        y2={50}
      />
      <circle
        className="chart-hover-dot"
        cx={hoverX}
        cy={hoverY}
        r={1.4}
      />
    </>
  )}
</svg>


                      </div>
                    </div>

                    <div className="portfolio-header-content premium-meta">
                      <div className="premium-main-row">
                        <div className="portfolio-main-left">
<span className="portfolio-value">
  {formatUsd(currentValue, 0)}  {/* no decimals like $16,980,892 */}
</span>
                        </div>
                      </div>

{hasHistory ? (
  <div className="portfolio-sub-row premium-sub-row">
    {/* percent pill on the left */}
    <span
      className={`portfolio-change-pill ${isUp ? "pill-up" : "pill-down"}`}
      style={{ marginRight: "8px" }}
    >
      <span className="change-arrow">{isUp ? "▲" : "▼"}</span>
      <span className="change-pct">{changePct.toFixed(2)}%</span>
    </span>

    {/* dollar change on the right */}
<span
  className={`portfolio-sub-value portfolio-pnl-abs ${
    changeAbs >= 0 ? 'pnl-up' : 'pnl-down'
  }`}
>
  {changeAbs >= 0 ? '+' : '-'}
  {formatUsd(Math.abs(changeAbs), 2)}
</span>
  </div>
) : (
  <div className="portfolio-sub-row premium-sub-row">
    <span className="portfolio-sub-label">no history yet</span>
    <span className="portfolio-sub-value">$0.00</span>
  </div>
)}


                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* asset distribution cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">wallet</div>
                {showSkeleton ? (
                  <>
                    <div className="skeleton skeleton-lg" />
                    <div className="skeleton skeleton-sm" />
                  </>
                ) : (
                  <>
<div className="stat-value">{formatUsd(walletUsd, 2)}</div>
                    <div className="stat-note">spot assets on ink</div>
                  </>
                )}
              </div>

              <div className="stat-card">
<div className="stat-label">POSITIONS</div>
                {showSkeleton ? (
                  <>
                    <div className="skeleton skeleton-lg" />
                    <div className="skeleton skeleton-sm" />
                  </>
                ) : (
                  <>
<div className="stat-value">{formatUsd(yieldingUsd, 2)}</div>
                    <div className="stat-note">
  staked, deposits, LP
                    </div>
                  </>
                )}
              </div>


              <div className="stat-card">
                <div className="stat-label">nfts</div>
                {showSkeleton ? (
                  <>
                    <div className="skeleton skeleton-lg" />
                    <div className="skeleton skeleton-sm" />
                  </>
                ) : (
                  <>
                    <div className="stat-value">{nftCount}</div>
                    <div className="stat-note">total nfts owned</div>
                  </>
                )}
              </div>

            </div>

{/* holdings + tabs */}
<section className="positions-section">
  <div className="ink-divider"></div>
<div className="positions-header-row">
  <div className="portfolio-title-stack">
    <div className="section-title">Portfolio</div>
    <div className="section-subtitle">on ink</div>
  </div>


    <div className="positions-tabs">
      <button
        className={
          positionsTab === "wallet"
            ? "positions-tab-btn positions-tab-btn-active"
            : "positions-tab-btn"
        }
        onClick={() => setPositionsTab("wallet")}
      >
        Wallet
      </button>
      <button
        className={
          positionsTab === "yielding"
            ? "positions-tab-btn positions-tab-btn-active"
            : "positions-tab-btn"
        }
        onClick={() => setPositionsTab("yielding")}
      >
        Positions
      </button>
      <button
        className={
          positionsTab === "nfts"
            ? "positions-tab-btn positions-tab-btn-active"
            : "positions-tab-btn"
        }
        onClick={() => setPositionsTab("nfts")}
      >
        NFTs
      </button>
            <button
        className={
          positionsTab === "transactions"
            ? "positions-tab-btn positions-tab-btn-active"
            : "positions-tab-btn"
        }
        onClick={() => setPositionsTab("transactions")}
      >
        Transactions
      </button>
    </div>
  </div>

{/* TAB 1: wallet tokens (current table) */}
<div
  className='positions-table wallet-table'
  style={{ display: positionsTab === 'wallet' ? 'block' : 'none' }}
>
      {/* table header */}
    <div className='positions-row positions-row-head wallet-head'>
      <span className='col-token wallet-head-col'>Token</span>
      <span className='col-price wallet-head-col'>Price</span>
      <span className='col-amount wallet-head-col'>Amount</span>
      <span className='col-value wallet-head-col'>Value (USD)</span>
    </div>


      {/* loading state */}
      {showSkeleton && (
        <div className="positions-row">
          <span className="col-token">
            <span className="token-icon skeleton skeleton-rect" />
            <span className="skeleton skeleton-md" style={{ flex: 1 }} />
          </span>
          <span className="col-price">
            <span className="skeleton skeleton-sm" />
          </span>
          <span className="col-amount">
            <span className="skeleton skeleton-sm" />
          </span>
          <span className="col-value">
            <span className="skeleton skeleton-sm" />
          </span>
        </div>
      )}

      {/* error state */}
      {portfolioError && !isLoadingPortfolio && (
        <div className="positions-row positions-row-empty">
          <span className="col-token">could not load portfolio</span>
          <span className="col-price"></span>
          <span className="col-amount"></span>
          <span className="col-value"></span>
        </div>
      )}

{/* no tokens */}
{!isLoadingPortfolio &&
  !portfolioError &&
  portfolio &&
walletTokens.length === 0 && (
    <div className="positions-row positions-row-empty">
      <span className="col-token">no tokens found</span>
      <span className="col-price"></span>
      <span className="col-amount"></span>
      <span className="col-value"></span>
    </div>
  )}


      {/* real tokens from api */}
{!isLoadingPortfolio &&
  !portfolioError &&
  portfolio &&
walletTokens.map((t) => {
const price = t.priceUsd ?? 0
const value = t.valueUsd ?? price * t.balance


          return (
            <div
              className="positions-row"
              key={t.address || t.symbol}
            >
              <span className="col-token">
                <span className="token-icon">
{t.iconUrl || tokenIcons[t.address.toLowerCase()] ? (
  <img
    src={t.iconUrl || tokenIcons[t.address.toLowerCase()]}

                      alt={t.symbol || "token"}
                      className="token-icon-img"
                    />
                  ) : (
                    (t.symbol || "?").slice(0, 3).toUpperCase()
                  )}
                </span>

                <a
                  className="asset-pill asset-pill-link"
                  href={`https://explorer.inkonchain.com/token/${t.address}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.symbol || "unknown"}
                </a>
              </span>

<span className="col-price">
  {price ? formatUsd(price, 4) : '-'}
</span>


<span className="col-amount">
  {formatAmount(t.balance, 4)}  {/* 14,382,027.2943 style */}
</span>


<span className="col-value">
  {formatUsd(value, 2)}
</span>
            </div>
          );
        })}
    </div>

{/* TAB 2: yielding pools */}
<div
  className="positions-table yielding-table"
  style={{ display: positionsTab === "yielding" ? "block" : "none" }}
>
  <div className="positions-row positions-row-head yielding-head">

  {/* PROTOCOL */}
<span className='col-token nft-head-col' style={{ width: '22%' }}>
  Protocol
</span>

<span className='col-token nft-head-col' style={{ width: '30%' }}>
  Pool
</span>

<span className='col-amount nft-head-col' style={{ width: '28%', textAlign: 'center' }}>
  Balance
</span>

<span className='col-amount nft-head-col' style={{ width: '10%', textAlign: 'center' }}>
  Rewards
</span>

<span className='col-value nft-head-col' style={{ width: '10%', textAlign: 'right' }}>
  Value (USD)
</span>

</div>




    {showSkeleton && (
      <div className="positions-row">
        <span className="col-token">
          <span className="skeleton skeleton-md" style={{ flex: 1 }} />
        </span>
        <span className="col-price">
          <span className="skeleton skeleton-sm" />
        </span>
        <span className="col-amount">
          <span className="skeleton skeleton-sm" />
        </span>
        <span className="col-value">
          <span className="skeleton skeleton-sm" />
        </span>
      </div>
    )}

    {!showSkeleton &&
      !portfolioError &&
      portfolio &&
      yieldingPositions.length === 0 && (
        <div className="positions-row positions-row-empty">
          <span className="col-token">no yielding positions found</span>
          <span className="col-price"></span>
          <span className="col-amount"></span>
          <span className="col-value"></span>
        </div>
      )}

{!showSkeleton &&
  !portfolioError &&
  portfolio &&
  (() => {
    type YieldView = {
      v: any;
      positionType: string;
      depositedUsd: number;
      amount: number;
      apr: number;
      protocolLabel: string;
      creatorAddr: string;
      finalIconSrc: string;
      protocolUrl: string | null;
      explorerUrl: string | null;
    };

const groups: {
  key: string;
  protocolLabel: string;
  kindLabel: string;
  iconSrc: string;
  manualIconSrc: string | null;
  protocolUrl: string | null;
  explorerUrl: string | null;
  totalUsd: number;
  rows: YieldView[];
}[] = [];



    const byKey: Record<string, number> = {};

    yieldingPositions.forEach((v: any) => {
      const label =
        v.poolName ||
        v.name ||
        v.symbol ||
        'yield position';

      const platform = v.protocol || 'unknown';

      const depositedUsd = Number(v.depositedUsd ?? v.valueUsd ?? 0);
      const amount = Number(v.amount ?? 0);
      const apr = Number(v.apr ?? v.apy ?? 0);

      const rawAddr =
        (v.tokenAddress as string) ||
        (v.poolAddress as string) ||
        (v.contractAddress as string) ||
        '';

    const creatorAddr = (((v.factoryAddress as string) || (v.creatorAddress as string) || '')).toLowerCase();

const protoFromCreator = creatorAddr ? getProtocolByAddress(creatorAddr) : null

const protocolLabel = creatorAddr
  ? (protoFromCreator?.label || shortAddress(creatorAddr))
  : platform



      const upperSym = (v.symbol || '').toUpperCase();
      const upperPool = (label || '').toUpperCase();

let positionType = 'Other';

if (v.lpBreakdown) {
  positionType = 'Liquidity pool';
} else if (
  upperPool.includes('VAULT') ||
  upperPool.includes('HYDRO') ||
  upperPool.includes('DCA')
) {
  positionType = 'Vault';
} else if (
  (upperSym.startsWith('S') && upperSym.includes('STK')) ||
  upperPool.includes('STAKED')
) {
  positionType = 'Staked';
} else {
  positionType = 'Other';
}


      const groupKind =
        positionType === 'Liquidity pool'
          ? 'Liquidity pool'
          : positionType === 'Vault'
          ? 'Vault'
          : 'Deposits';

      const addrKey = rawAddr.toLowerCase();

const protoFromAddr = addrKey ? getProtocolByAddress(addrKey) : null


const protocolUrl =
  protoFromCreator?.url ||
  protoFromAddr?.url ||
  null





      const faviconUrl = protocolUrl ? getFavicon(protocolUrl) : null;

const manualIconKey =
  protoFromCreator?.icon ||
  protoFromAddr?.icon ||
  ''



      const manualIconSrc = manualIconKey
        ? `/platforms/${manualIconKey}.svg`
        : null;

      const finalIconSrc =
        faviconUrl ||
        manualIconSrc ||
        '/platforms/dapp.svg';

      const explorerUrl =
  (creatorAddr && creatorAddr.startsWith('0x') && creatorAddr.length === 42)
    ? `https://explorer.inkonchain.com/address/${creatorAddr}`
    : (addrKey && addrKey.startsWith('0x') && addrKey.length === 42)
      ? `https://explorer.inkonchain.com/address/${addrKey}`
      : null;


      const groupKey = `${protocolLabel}__${groupKind}`;

      let idx = byKey[groupKey];
      if (idx === undefined) {
        idx = groups.length;
        byKey[groupKey] = idx;
groups.push({
  key: groupKey,
  protocolLabel,
  kindLabel: groupKind,
  iconSrc: finalIconSrc,
  manualIconSrc,
  protocolUrl,
  explorerUrl,
  totalUsd: 0,
  rows: [],
});
      }

      groups[idx].rows.push({
        v,
        positionType,
        depositedUsd,
        amount,
        apr,
        protocolLabel,
        creatorAddr,
        finalIconSrc,
        protocolUrl,
        explorerUrl,
      });

      groups[idx].totalUsd += depositedUsd;
    });

return groups.map((group) => (
  <div
    key={group.key}
    className="yielding-protocol-group yielding-protocol-card"
  >

        {/* protocol header row */}
        <div className='positions-row yielding-protocol-header'>
          <span
            className='col-token'
            style={{
              width: '22%',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div className='tx-big-icon-wrapper protocol-icon'>
<img
  src={group.manualIconSrc || group.iconSrc || '/platforms/contract.svg'}
  alt={group.protocolLabel}
  className='tx-big-icon'
  data-local={group.manualIconSrc || ''}
data-llama={`/api/defillama-icon?icon=${encodeURIComponent(group.protocolLabel)}&w=48&h=48`}


  data-step="local"
  onError={(e) => {
    const img = e.currentTarget as HTMLImageElement
    const local = img.dataset.local || ''
    const llama = img.dataset.llama || ''
    const step = img.dataset.step || 'local'

    // local failed -> try llama
    if (step === 'local' && llama) {
      img.dataset.step = 'llama'
      img.src = llama
      return
    }

    // llama failed -> contract.svg
    img.dataset.step = 'done'
    img.src = '/platforms/contract.svg'
  }}
/>

              <div
                className={
                  group.kindLabel === 'Liquidity pool'
                    ? 'protocol-badge protocol-badge-lp'
                    : 'protocol-badge protocol-badge-stake'
                }
              >
                {group.kindLabel === 'Liquidity pool' ? 'LP' : 'S'}
              </div>
            </div>

            <div className='tx-platform-meta'>
              <div className='tx-method-text'>
                {group.protocolLabel}
              </div>

              {(group.protocolUrl || group.explorerUrl) && (
                <a
href={group.protocolUrl || group.explorerUrl || getPositionUrl(group.kindLabel) || '#'}
                  className='tx-platform-link'
                  target='_blank'
                  rel='noreferrer'
                >
                  <span className='tx-platform-link-label'>
                    view protocol
                  </span>
                  <span className='tx-platform-link-icon'>
                    <svg
                      xmlns='http://www.w3.org/2000/svg'
                      width='11'
                      height='11'
                      viewBox='0 0 24 24'
                    >
                      <path
                        d='M14 3h7v7'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='1.8'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                      <path
                        d='M10 14l11-11'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='1.8'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                      <path
                        d='M5 7v12h12'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='1.8'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </span>
                </a>
              )}
            </div>
          </span>

          {/* rest of header row empty to keep columns aligned */}
          <span className='col-token' style={{ width: '30%' }} />
          <span className='col-amount' style={{ width: '28%' }} />
          <span className='col-amount' style={{ width: '10%' }} />
<span
  className='col-value yielding-protocol-total'
  style={{ width: '10%', textAlign: 'right' }}
>
  {formatUsd(group.totalUsd, 2)}
</span>
        </div>

        {/* tiny label row like DeBank "Liquidity pool" under protocol name */}
        <div className='positions-row yielding-kind-row'>
<span
  className='col-token'
  style={{
    width: '22%',
    paddingLeft: 54,
    display: 'flex',
    alignItems: 'center',
  }}
>
  <span
    style={{
      fontSize: 10,
      fontWeight: 600,
      background: 'var(--ink-badge-bg, rgba(0,0,0,0.06))',
      padding: '2px 6px',
      borderRadius: 6,
      textTransform: 'uppercase',
      opacity: 0.7,
      letterSpacing: 0.3,
    }}
  >
    {group.kindLabel}
  </span>
</span>

          <span className='col-token' style={{ width: '30%' }} />
          <span className='col-amount' style={{ width: '28%' }} />
          <span className='col-amount' style={{ width: '10%' }} />
          <span className='col-value' style={{ width: '10%' }} />
        </div>

        {/* real rows for that protocol */}
        {group.rows.map(({ v, depositedUsd, amount, apr }, idx) => (
          <div className='positions-row yielding-row' key={group.key + idx}>
            {/* protocol column now empty to avoid repeating icon */}
            <span
              className='col-token'
              style={{ width: '22%' }}
            />

            {/* POOL column: keep your existing LP pair code */}
            <span
              className='col-token'
              style={{
                width: '30%',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {(() => {
                const label =
                  v.poolName ||
                  v.name ||
                  v.symbol ||
                  'yield position';

                const poolText = label || '';
                let leftSym = '';
                let rightSym = '';

                if (
                  v.lpBreakdown &&
                  v.lpBreakdown.token0Symbol &&
                  v.lpBreakdown.token1Symbol
                ) {
                  leftSym = v.lpBreakdown.token0Symbol;
                  rightSym = v.lpBreakdown.token1Symbol;
                } else {
                  const match = poolText.match(
                    /([A-Za-z0-9]+)\/([A-Za-z0-9]+)/
                  );
                  if (match) {
                    leftSym = match[1];
                    rightSym = match[2];
                  }
                }

                const displayLabel =
                  leftSym && rightSym
                    ? `${leftSym}+${rightSym}`
                    : poolText || 'LP token';

// prefer backend lpBreakdown icons, fall back to symbol lookup
const leftIcon =
  v.lpBreakdown?.token0IconUrl ||
  (leftSym ? findTokenIconBySymbol(leftSym) : null);

const rightIcon =
  v.lpBreakdown?.token1IconUrl ||
  (rightSym ? findTokenIconBySymbol(rightSym) : null);


    const token0Addr = v.lpBreakdown?.token0Address;
    const token1Addr = v.lpBreakdown?.token1Address;

    const singleTokenAddr =
      (v.tokenAddress as string) ||
      (v.poolAddress as string) ||
      (v.contractAddress as string) ||
      '';

    // LP pair branch
    if (token0Addr && token1Addr && leftSym && rightSym) {
      return (
        <>
          <div className="lp-pair-icons">
            <div className="lp-pair-icon lp-pair-icon-left">
              {leftIcon ? (
                <img
                  src={leftIcon}
                  className="lp-pair-icon-img"
                  alt={leftSym || 'token'}
                />
              ) : (
                (leftSym || poolText || '?')[0].toUpperCase()
              )}
            </div>
            <div className="lp-pair-icon lp-pair-icon-right">
              {rightIcon ? (
                <img
                  src={rightIcon}
                  className="lp-pair-icon-img"
                  alt={rightSym || 'token'}
                />
              ) : (
                rightSym ? rightSym[0].toUpperCase() : ''
              )}
            </div>
          </div>

          <span
            style={{
              whiteSpace: 'normal',
              overflow: 'visible',
            }}
            className="yield-token-pair"
          >
            <a
              className="yield-token-link"
              href={`https://explorer.inkonchain.com/token/${token0Addr}`}
              target="_blank"
              rel="noreferrer"
            >
              {leftSym}
            </a>
            <span className="yield-token-plus"> + </span>
            <a
              className="yield-token-link"
              href={`https://explorer.inkonchain.com/token/${token1Addr}`}
              target="_blank"
              rel="noreferrer"
            >
              {rightSym}
            </a>
          </span>
        </>
      );
    }

    // single asset branch  iETH, ULTRAETH etc
    return (
      <div className="pool-asset-row">
        <a
          href={
            singleTokenAddr
              ? `https://explorer.inkonchain.com/token/${singleTokenAddr}`
              : '#'
          }
          target="_blank"
          rel="noopener noreferrer"
          className="single-asset-link"
        >
          <span className="token-icon">
            {leftIcon ? (
              <img
                src={leftIcon}
                className="token-icon-img"
                alt={displayLabel || 'token'}
              />
            ) : (
              (displayLabel || '?')[0].toUpperCase()
            )}
          </span>

      <span
        className="token-symbol"
        style={{ whiteSpace: 'nowrap' }}
      >
        {displayLabel}
      </span>
        </a>
      </div>
    );
              })()}
            </span>

            {/* BALANCE */}
            <span
              className='col-amount'
              style={{ width: '28%', textAlign: 'center' }}
            >
              {v.lpBreakdown &&
              v.lpBreakdown.amount0 &&
              v.lpBreakdown.amount1 ? (
                <div className='yielding-balance-lines'>
                  <div>
                    {v.lpBreakdown.amount0.toFixed(6)}{' '}
                    {v.lpBreakdown.token0Symbol}
                  </div>
                  <div>
                    {v.lpBreakdown.amount1.toFixed(6)}{' '}
                    {v.lpBreakdown.token1Symbol}
                  </div>
                </div>
              ) : amount ? (
                amount.toFixed(4)
              ) : (
                '-'
              )}
            </span>

            {/* APR as rewards column */}
            <span
              className='col-amount'
              style={{ width: '10%', textAlign: 'center' }}
            >
              {apr ? `${apr.toFixed(2)}%` : '-'}
            </span>

            {/* VALUE */}
            <span
  className='col-value'
  style={{ width: '10%', textAlign: 'right' }}
>
  {formatUsd(depositedUsd, 2)}
</span>
          </div>
        ))}
      </div>
    ));
  })()}

  </div>



{/* TAB 3: NFTs */}
<div
  className='positions-table nft-table'
  style={{ display: positionsTab === 'nfts' ? 'block' : 'none' }}
>

    {/* header */}
<div className='positions-row positions-row-head nft-head'>
  {/* 1. collection */}
  <span className='col-token nft-head-col'>
    Collection
  </span>

  {/* 2. spacer */}
  <span />

  {/* 3. balance (sortable) */}
  <span
    className='col-amount nft-head-col'
    style={{ display: 'flex', justifyContent: 'center' }}
    onClick={() => handleNftSort('balance')}
  >
    <span className='nft-sort-label'>
      Balance
      <span className='nft-sort-arrow'>
        {nftSortBy === 'balance'
          ? nftSortDir === 'asc'
            ? '▲'
            : '▼'
          : '↕'}
      </span>
    </span>
  </span>

  {/* 4. total spent (sortable) */}
  <span
    className='col-value nft-head-col'
    style={{ textAlign: 'right' }}
    onClick={() => handleNftSort('spent')}
  >
    <span className='nft-sort-label'>
      Total spent
      <span className='nft-sort-arrow'>
        {nftSortBy === 'spent'
          ? nftSortDir === 'asc'
            ? '▲'
            : '▼'
          : '↕'}
      </span>
    </span>
  </span>

  {/* 5. floor */}
  <span
    className='col-value nft-head-col'
    style={{ textAlign: 'right' }}
  >
    Floor (USD)
  </span>
</div>


    {/* rows */}
{sortedNfts.map(col => {
  const firstToken = col.tokens[0];

  return (
    <div className='positions-row' key={col.address}>
      {/* 1. collection */}
      <span
        className='col-token'
        style={{
          display: 'flex',
          alignItems: 'center',
          minWidth: 0,
        }}
      >
        <span className='token-icon'>
          {firstToken?.imageUrl ? (
            <img
              src={firstToken.imageUrl}
              className='token-icon-img'
              alt={col.name}
            />
          ) : (
            (col.symbol || '?').slice(0, 3).toUpperCase()
          )}
        </span>

        <a
          className='nft-collection-link'
          href={`https://explorer.inkonchain.com/token/${col.address}?tab=holders`}
          target='_blank'
          rel='noreferrer'
          style={{
            marginLeft: 12,
            flex: 1,
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {col.name}
        </a>
      </span>

      {/* 2. spacer */}
      <span />

      {/* 3. balance */}
      <span
        className='col-amount'
        style={{
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {col.ownedCount || col.tokens.length}
      </span>

      {/* 4. total spent */}
<span
  className='col-value'
  style={{ textAlign: 'right' }}
>
  {(() => {
    const key = (col.address || '').toLowerCase()
    const spent = perCollectionSpentUsd[key]
    return spent != null && spent > 0
        ? formatUsd(spent, 2)
      : '-'
  })()}
</span>



      {/* 5. floor value placeholder for now */}
      <span
        className='col-value'
        style={{ textAlign: 'right' }}
      >
        -
      </span>
    </div>
  );
})}

  </div>



{/* TAB 4: transactions */}
<div
  className="positions-table tx-table"
  style={{ display: positionsTab === "transactions" ? "block" : "none" }}
>

    {/* filter input */}
    <div
      className="search-wrapper"
      style={{
        marginBottom: 8,
        maxWidth: 280,
        position: "relative",
      }}
    >
      <span className="search-icon">
        <svg width="14" height="14" viewBox="0 0 24 24">
          <circle
            cx="11"
            cy="11"
            r="7"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
          />
          <line
            x1="16"
            y1="16"
            x2="21"
            y2="21"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>

      <input
        placeholder={
          txSelectedToken
            ? `Filter by token: ${txSelectedToken.symbol}`
            : "Filter by token or contract"
        }
        value={txTokenQuery}
        onChange={(e) => {
          setTxTokenQuery(e.target.value);
          setTxTokenDropdownOpen(true);
        }}
        onFocus={() => {
          if (txTokenQuery.trim()) setTxTokenDropdownOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        onBlur={() => {
          setTimeout(() => setTxTokenDropdownOpen(false), 120);
        }}
      />

      {(txTokenQuery || txSelectedToken) && (
        <button
          type="button"
          onClick={() => {
            setTxTokenQuery("");
            setTxSelectedToken(null);
            setTxTokenDropdownOpen(false);
            setTxPage(1);
          }}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 14,
            opacity: 0.7,
          }}
        >
          ×
        </button>
      )}

{txTokenDropdownOpen && txTokenSuggestions.length > 0 && (
  <div className="tx-token-dropdown">
    {txTokenSuggestions.map((tok) => {
      const addrKey = tok.address.toLowerCase();
      const portfolioToken =
        portfolio?.tokens.find(
          (t) => t.address && t.address.toLowerCase() === addrKey
        ) || null;

      const iconSrc = tokenIcons[addrKey] || portfolioToken?.iconUrl || null;

      return (
        <button
          key={tok.address}
          type="button"
          className="tx-token-item"
          onMouseDown={(e) => {
            e.preventDefault();
            setTxSelectedToken(tok);
            setTxTokenQuery(tok.symbol || tok.address);
            setTxTokenDropdownOpen(false);
            setTxPage(1);
            setTxHasMore(false);
          }}
        >
          <span className="tx-token-avatar">
            {iconSrc ? (
              <img
                src={iconSrc}
                alt={tok.symbol || 'token'}
                className="tx-token-avatar-img"
              />
            ) : (
              (tok.symbol || '?')[0].toUpperCase()
            )}
          </span>

          <div className="tx-token-meta">
            <span className="tx-token-symbol">{tok.symbol}</span>
            <span className="tx-token-address">
              {tok.address.slice(0, 6)}...{tok.address.slice(-4)}
            </span>
          </div>
        </button>
      );
    })}
  </div>
)}
    </div>

    {/* FULL PAGE LOADER */}
{showTxFullLoader ? (
  <div className='tx-full-loader'>
    <div className='tx-full-spinner' />
  </div>
) : (
  <>
        {/* header */}
        <div className="positions-row positions-row-head tx-row-head">
          <span className="col-a">Date / Hash</span>
          <span className="col-b">Platform</span>
          <span className="col-c">Type</span>
          <span className="col-d">Gas Fee</span>
        </div>

        {/* error */}
        {txError && (
          <div className="positions-row positions-row-empty">
            <span className="col-a">{txError}</span>
            <span className="col-b"></span>
            <span className="col-c"></span>
            <span className="col-d"></span>
          </div>
        )}

        {/* empty */}
        {!txError && walletAddress && filteredTxs.length === 0 && (
          <div className="positions-row positions-row-empty">
            <span className="col-a">no transactions found</span>
            <span className="col-b"></span>
            <span className="col-c"></span>
            <span className="col-d"></span>
          </div>
        )}

        {/* rows */}
{filteredTxs.map((tx) => {

// scam filter should only tag low-signal INCOMING junk
// never tag OUT / SELF tx as scam
const legs = parseTxDetails(tx.details);

const hasOut = legs.some((l) => l.direction === "out");
const hasIn = legs.some((l) => l.direction === "in");
const allInOnly = legs.length > 0 && legs.every((l) => l.direction === "in");

// basic intent signals
const lowerDetails = (tx.details || "").toLowerCase();
const methodLower = (tx.method || "").toLowerCase();
const looksIntentional =
  methodLower.includes("swap") ||
  methodLower.includes("approve") ||
  methodLower.includes("increaseallowance") ||
  methodLower.includes("decreaseallowance") ||
  lowerDetails.includes("swap") ||
  lowerDetails.includes("approve");

// only consider scam if it is incoming and has zero native value and no outgoing leg
const allTokenSymbolsLookSpam =
  tx.tokens.length > 0 &&
  tx.tokens.every((t) => isSpamSymbol(t.symbol));

const hasNativeValue = Number(tx.valueInk || 0) > 0;

const isScamTx =
  tx.direction === "in" &&
  !hasOut &&
  !hasNativeValue &&
  allInOnly &&
  allTokenSymbolsLookSpam &&
  !looksIntentional;

const isSwapLike = hasOut && hasIn && legs.length >= 2;
const methodName = (tx.method || "").trim();
const allIn = allInOnly;
const allOutOnly = legs.length > 0 && legs.every((l) => l.direction === "out");


  const isFailed =
    (tx.status || '').toLowerCase() !== 'ok';

  const contractName = tx.toLabel || "";
  const contractNameLower = contractName.toLowerCase();

  const hasGmToken = tx.tokens.some((t) =>
    (t.symbol || "").toLowerCase().includes("gm")
  );

  let platformMain = "Contract";
  let platformSub: string | null = null;
  let platformClass = "contract";

  // prefer the decoded primary app contract if backend sends it
  const primaryLabelRaw =
    (tx.primaryAppLabel && tx.primaryAppLabel.trim().length > 0)
      ? tx.primaryAppLabel.trim()
      : (tx.toLabel || "");
  const primaryAddress = tx.primaryAppAddress || tx.to;

  let contractDisplay = '';

  const rawLabel = (tx.primaryAppLabel || tx.toLabel || '')?.trim();
  const rawAddr = tx.primaryAppAddress || tx.to;

  if (rawLabel && rawLabel.length > 0) {
    contractDisplay =
      rawLabel.startsWith('0x') && rawLabel.length > 14
        ? formatAddress(rawLabel)
        : rawLabel;
  } else if (rawAddr) {
    contractDisplay = formatAddress(rawAddr);
  } else {
    contractDisplay = '';
  }




  // gm style app
  if (
    methodName.toLowerCase() === "gm" ||
    lowerDetails.includes("gm") ||
    contractNameLower.includes("ink gm") ||
    hasGmToken
  ) {
    platformMain = "gm";
    platformSub = contractName || "Ink GM";
    platformClass = "app";
  }
  // approvals
  else if (lowerDetails.includes("approve")) {
    platformMain = methodName || "Approve";
    const firstSym = tx.tokens[0]?.symbol;
    platformSub = contractName || firstSym || "Token";
    platformClass = "approval";
  }
  // swaps and routers
  else if (isSwapLike || lowerDetails.includes("swap")) {
    platformMain = methodName || "Swap";
    platformSub = contractName || "DEX trade";
    platformClass = "swap";
  }
  // nft transfers
  else if (tx.hasNft) {
    platformMain = "NFT";
    platformSub = contractName || "Transfer";
    platformClass = "nft";
  }
  // token or native send only
  else if (allOutOnly) {
    platformMain = "Send";
    platformSub = contractName || formatAddress(tx.otherParty);
    platformClass = "send";
  }
  // token or native receive only  airdrops rewards etc
  else if (allIn) {
    platformMain = "Receive";
    platformSub = contractName || formatAddress(tx.otherParty);
    platformClass = "receive";
  }



  return (
    <div
      className={`positions-row tx-row ${
        isSwapLike ? 'swap-row' : ''
      } ${isScamTx ? 'tx-scam-row' : ''} ${
        isFailed ? 'tx-failed' : ''
      }`}
      key={tx.hash}
    >


<span className='col-a'>
  {isFailed && (
    <div className='tx-status-pill tx-status-pill-failed'>
      Failed
    </div>
  )}

  {isScamTx && (
    <div className='tx-scam-tag'>
      Scam tx
    </div>
  )}


  <div className='tx-date-wrap'>
    <span className='tx-date-main'>
{formatDateTimeLabel(tx.timestamp < 2_000_000_000 ? tx.timestamp * 1000 : tx.timestamp)}
    </span>
    <span className='tx-date-sub'>
{formatLastUpdated(tx.timestamp < 2_000_000_000 ? tx.timestamp * 1000 : tx.timestamp)}
    </span>
  </div>

  <a
    href={`https://explorer.inkonchain.com/tx/${tx.hash}`}
    target='_blank'
    rel='noreferrer'
    className='tx-hash'
  >
    {formatAddress(tx.hash)}
  </a>
</span>


{/* col B: debank style platform */}
<span className="col-b">
  {(() => {
// Determine which icon to use
let iconKey = "";
const appAddr = (tx.primaryAppAddress || tx.to || "").toLowerCase();
const proto = getProtocolByAddress(appAddr)
const platformIcon = proto?.icon || ''

if (platformIcon) {
  iconKey = platformIcon
} else if (platformMain === 'Send') {
  iconKey = 'send'
} else if (platformMain === 'Receive') {
  iconKey = 'receive'
} else {
  iconKey = ''
}


    return (
      <div className="tx-platform-block">
        {/* BIG square icon */}
        <div className="tx-big-icon-wrapper">
<img
  src={
    iconKey
      ? `/platforms/${iconKey}.svg`
      : '/platforms/contract.svg'
  }
  alt={tx.toLabel || 'platform'}
  className="tx-big-icon"
  data-local={iconKey ? `/platforms/${iconKey}.svg` : ''}
data-llama={
  iconKey
    ? `/api/defillama-icon?icon=${encodeURIComponent(iconKey)}&w=48&h=48`
    : ''
}

  data-step="local"
  onError={(e) => {
    const img = e.currentTarget as HTMLImageElement
    const local = img.dataset.local || ''
    const llama = img.dataset.llama || ''
    const step = img.dataset.step || 'local'

    // local failed -> try llama
    if (step === 'local' && llama) {
      img.dataset.step = 'llama'
      img.src = llama
      return
    }

    // llama failed -> contract.svg
    img.dataset.step = 'done'
    img.src = '/platforms/contract.svg'
  }}
/>

        </div>

        {/* Texts */}
        <div className="tx-platform-meta">
          {/* METHOD */}
          {tx.method && (
            <div className="tx-method-text">{tx.method}</div>
          )}

          {/* PLATFORM NAME — clickable search */}
<div className='relative'>
  <div
    className='tx-platform-text'
    onClick={async () => {
      const raw = (tx.primaryAppAddress || tx.to || '').trim();
      if (!raw) return;

      const lower = raw.toLowerCase();

      try {
        await navigator.clipboard.writeText(lower);
        setTxCopiedKey(lower);
        setTimeout(() => {
          setTxCopiedKey(current =>
            current === lower ? null : current
          );
        }, 800);
      } catch (e) {
        console.error('copy failed', e);
      }
    }}
    title={(tx.primaryAppAddress || tx.to || '').toLowerCase()}
  >
    {contractDisplay}

    {txCopiedKey === (tx.primaryAppAddress || tx.to || '').toLowerCase() && (
      <div className='copy-popup'>copied</div>
    )}
  </div>
</div>
        </div>
      </div>
    );
  })()}
</span>


<span className="col-c">
  {(() => {
    const rawLegs = parseTxDetails(tx.details);

    if (rawLegs.length === 0) {
      return <div className="tx-title">{tx.details}</div>;
    }

    // group by direction + symbol
    const groupMap: Record<string, TxLeg> = {};

    for (const leg of rawLegs) {
      const key =
        leg.direction + ":" + (leg.symbol || "").toUpperCase();

      if (!groupMap[key]) {
        groupMap[key] = {
          direction: leg.direction,
          amount: leg.amount,
          symbol: leg.symbol,
        };
      } else {
        const prevAmt = groupMap[key].amount ?? 0;
        const curAmt = leg.amount ?? 0;
        groupMap[key].amount = prevAmt + curAmt;
      }
    }

    // turn map into array
    const legs = Object.values(groupMap);

    // outs first, then ins
    legs.sort((a, b) => {
      if (a.direction === b.direction) return 0;
      return a.direction === "out" ? -1 : 1;
    });

    return (
      <>
        {legs.slice(0, 4).map((leg, idx) => {
          const sign = leg.direction === "out" ? "-" : "+";
          const lineClass =
            leg.direction === "out"
              ? "tx-amount-line tx-out"
              : "tx-amount-line tx-in";

// 1) always resolve symbol first
const symbolUpper = (leg.symbol || '').toUpperCase();

const isNft = symbolUpper.includes('#');

const amountText =
  leg.amount == null
    ? ''
    : isNft
    ? formatAmount(leg.amount, 0)   // 1, 2, 3 (no decimals, with commas)
    : formatAmount(leg.amount, 4);  // 14,382,027.2943 style
    
// 2) native coin override: ETH / INK always forced
if (symbolUpper === 'ETH') {
  const iconSrc = 'https://assets.coingecko.com/coins/images/279/large/ethereum.png';
  const priceUsd = nativeUsdPrice || undefined;
  const valueUsd =
    leg.amount != null && priceUsd != null
      ? leg.amount * priceUsd
      : null;

  return (
    <div key={idx} className={lineClass}>
      <div className="tx-amount-icon">
        <img src={iconSrc} alt="ETH" className="tx-amount-icon-img" />
      </div>
      <span className="tx-amount-symbol">
{sign} {leg.amount != null ? formatAmount(leg.amount, 4) : ''} ETH
{valueUsd != null ? ` (${formatUsd(valueUsd, 2)})` : ''}
      </span>
    </div>
  );
}

if (symbolUpper === 'INK') {
  const iconSrc = 'https://explorer.inkonchain.com/images/token.png';
  const priceUsd = nativeUsdPrice || undefined;
  const valueUsd =
    leg.amount != null && priceUsd != null
      ? leg.amount * priceUsd
      : null;

  return (
    <div key={idx} className={lineClass}>
      <div className="tx-amount-icon">
        <img src={iconSrc} alt="INK" className="tx-amount-icon-img" />
      </div>
      <span className="tx-amount-symbol">
{sign} {leg.amount != null ? formatAmount(leg.amount, 4) : ''} INK
{valueUsd != null ? ` (${formatUsd(valueUsd, 2)})` : ''}
      </span>
    </div>
  );
}

// 3) all other tokens continue normally
const matchToken =
  tx.tokens.find(
    (t) =>
      (t.symbol || '').toUpperCase() === symbolUpper
  ) || tx.tokens[idx];

let addrKey = matchToken?.address
  ? matchToken.address.toLowerCase().trim()
  : '';

  // If symbol contains #, it's an NFT → fetch Blockscout icon


let portfolioToken =
  portfolio?.tokens.find(
    (t) => t.address && t.address.toLowerCase() === addrKey
  ) || null;

// fallback match by symbol if only one
if (!portfolioToken && leg.symbol && portfolio?.tokens) {
  const candidates = portfolio.tokens.filter(
    (t) => (t.symbol || '').toUpperCase() === symbolUpper
  );
  if (candidates.length === 1) {
    portfolioToken = candidates[0];
    if (!addrKey && portfolioToken.address) {
      addrKey = portfolioToken.address.toLowerCase();
    }
  }
}

// final icon (non-native)
// final icon (non-native)  // merged NFT + amount line
let iconSrc: string | undefined;

// if this leg looks like an NFT "BOI #4182", use NFT collection icon
if (symbolUpper.includes("#")) {
  const nftAddr = (tx.tokens[0]?.address || "").toLowerCase();
  if (nftAddr) {
    const col =
      nftCollections?.find(
        (c) => c.address.toLowerCase() === nftAddr
      ) || null;

    iconSrc =
      col?.tokens?.[0]?.imageUrl ||
      tokenIcons[nftAddr] ||
      undefined;
  }
}

// normal tokens fallback
if (!iconSrc) {
  iconSrc =
    portfolioToken?.iconUrl ||
    (addrKey && tokenIcons[addrKey]) ||
    undefined;
}

const priceUsd =
  addrKey && tokenPriceMap[addrKey] != null
    ? tokenPriceMap[addrKey]
    : undefined;


const valueUsd =
  leg.amount != null && priceUsd != null
    ? leg.amount * priceUsd
    : null;



          return (
            <div key={idx} className={lineClass}>
              <div className="tx-amount-icon">
                {iconSrc ? (
                  <img
                    src={iconSrc}
                    alt={leg.symbol || "token"}
                    className="tx-amount-icon-img"
                  />
                ) : (
                  (leg.symbol || "T")[0].toUpperCase()
                )}
              </div>

<span className='tx-amount-symbol'>
  {sign} {amountText} {leg.symbol}
  {valueUsd != null ? ` (${formatUsd(valueUsd, 2)})` : ''}
</span>
            </div>
          );
        })}
      </>
    );
  })()}
</span>

              <span className="col-d">
                {tx.gasFeeInk?.toFixed(6) || "-"}
                {tx.gasFeeUsd && (
                  <div className="fee-usd">
                    ${tx.gasFeeUsd.toFixed(4)}
                  </div>
                )}
              </span>
            </div>
          );
        })}

{txHasMore && walletAddress && (
  <div className="tx-load-more-wrapper">
    <button
      className="tx-load-more-btn"
      onClick={() => setTxPage(p => p + 1)}
      disabled={isLoadingTxs}
    >
      {isLoadingTxs ? 'loading...' : 'Load More'}
    </button>
  </div>
)}
      </>
    )}
  </div>

</section>
  </div>
)}



{activePage === 'Bridge' && (
<section
  className='positions-section'
  style={
    activePage === 'Bridge'
      ? { position: 'relative', opacity: 1, pointerEvents: 'auto' }
      : {
          position: 'fixed',
          left: -10000,
          top: 0,
          width: 560,
          height: 760,
          opacity: 0,
          pointerEvents: 'none',
        }
  }
  aria-hidden={activePage !== 'Bridge'}
>
  <div className='ink-divider'></div>
  <div className='positions-header-row'>
    <div className='portfolio-title-stack'>
      <div className='section-title'>Bridge</div>
      <div className='section-subtitle'>Powered by li.fi</div>
    </div>
  </div>

  <div style={{ marginTop: 12 }}>
    <SwapPanel />
  </div>
</section>
)}

<section
  className='positions-section'
  style={
activePage === 'Metrics'
      ? { position: 'relative', opacity: 1, pointerEvents: 'auto' }
      : {
          position: 'fixed',
          left: -10000,
          top: 0,
          width: 1200,
          height: 900,
          opacity: 0,
          pointerEvents: 'none',
        }
  }
  aria-hidden={activePage !== 'Metrics'}
>
  <div className='ink-divider'></div>
  <div className='positions-header-row'>
    <div className='portfolio-title-stack'>
      <div className='section-title'>Metrics</div>
      <div className='section-subtitle'>Powered by public on-chain data</div>
    </div>
  </div>

  <div style={{ marginTop: 20 }}>
    <InkMetricsLayout />
  </div>
</section>


{activePage === 'Ecosystem' && (
  <section className="positions-section">
    <div className="ink-divider"></div>

    <div className="positions-header-row">
      <div className="portfolio-title-stack">
        <div className="section-title">Ecosystem</div>
        <div className="section-subtitle">
          trusted apps building on ink
        </div>
      </div>
    </div>

    <div style={{ marginTop: 16 }}>
      <EcosystemGrid items={inkEcosystem} />
    </div>
  </section>
)}


{activePage === 'Explore' && (
  <section className="positions-section">
    <div className="ink-divider"></div>

    <div className="positions-header-row">
      <div className="portfolio-title-stack">
        <div className="section-title">Explore</div>
      </div>
    </div>

    <div style={{ marginTop: 16 }}>
      <ExploreDashboard />
    </div>
  </section>
)}


{activePage === 'Language' && (
  <section className="positions-section">
    <div className="ink-divider"></div>
    <div className="positions-header-row">
      <div className="portfolio-title-stack">
        <div className="section-title">Language</div>
        <div className="section-subtitle">coming soon</div>
      </div>
    </div>
  </section>
)}

          </div>
        </main>
      </div>
      {isFeedbackOpen && (
        <div
          className='feedback-overlay'
          onClick={() => setIsFeedbackOpen(false)}
        >
          <div
            className='feedback-modal'
            onClick={e => e.stopPropagation()}
          >
            <div className='feedback-modal-header'>
              <h2 className='feedback-title'>
                {feedbackCategory === 'contact'
                  ? 'Contact Us'
                  : 'Send feedback'}
              </h2>

  <button
    className="feedback-close-btn"
    onClick={() => setIsFeedbackOpen(false)}
  >
    ×
  </button>
            </div>

{feedbackCategory !== 'contact' && (
  <div className='feedback-type-row'>
    <button
      type='button'
      className={
        'feedback-type-chip' +
        (feedbackCategory === 'feature' ? ' active' : '')
      }
      onClick={() => setFeedbackCategory('feature')}
    >
      Feature request
    </button>

    <button
      type='button'
      className={
        'feedback-type-chip' +
        (feedbackCategory === 'bug' ? ' active' : '')
      }
      onClick={() => setFeedbackCategory('bug')}
    >
      Bug report
    </button>

    <button
      type='button'
      className={
        'feedback-type-chip' +
        (feedbackCategory === 'idea' ? ' active' : '')
      }
      onClick={() => setFeedbackCategory('idea')}
    >
      Idea
    </button>

    <button
      type='button'
      className={
        'feedback-type-chip' +
        (feedbackCategory === 'other' ? ' active' : '')
      }
      onClick={() => setFeedbackCategory('other')}
    >
      Other
    </button>
  </div>
)}



            <div className='feedback-body'>
              <label className='feedback-label'>
                {feedbackCategory === 'contact'
                  ? 'How can we help'
                  : 'What is on your mind'}
              </label>
<textarea
  className='feedback-textarea'
  rows={4}
  placeholder={
    feedbackCategory === 'contact'
      ? 'Describe what you need help with on inkfolio'
      : 'Tell us what you like, what is broken, or what you want next on ink'
  }
  value={feedbackMessage}
  onChange={e => setFeedbackMessage(e.target.value)}
/>

              <label className='feedback-label'>
                {isContactMode ? 'Contact info (required)' : 'contact info (optional)'}
              </label>
              <input
                className='feedback-input'
                placeholder='@handle or email'
                value={feedbackContact}
                onChange={e => setFeedbackContact(e.target.value)}
              />
              {isContactMode && feedbackContact && !contactIsValid && (
                <div className='feedback-error-text'>
                  enter a valid email or @username
                </div>
              )}
            </div>

            <div className='feedback-footer-row'>
              {feedbackStatus === 'ok' && (
                <span className='feedback-status-ok'>
                  Sent. Thank you for helping improve inkavern.
                </span>
              )}
              {feedbackStatus === 'error' && (
                <span className='feedback-status-error'>
                  Could not send feedback. Try again later.
                </span>
              )}

              <button
                type='button'
                className='feedback-submit-btn'
                disabled={
                  feedbackSending ||
                  !feedbackMessage.trim() ||
                  !contactIsValid
                }
                onClick={async () => {
                  if (!feedbackMessage.trim()) return;
                  try {
                    setFeedbackSending(true);
                    setFeedbackStatus('idle');

                    const res = await fetch('/api/feedback', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({
                        message: feedbackMessage,
                        category: feedbackCategory,
                        contact: feedbackContact,
                        wallet: walletAddress || null,
                      }),
                    });

                    if (!res.ok) {
                      throw new Error('bad status');
                    }

                    setFeedbackStatus('ok');
                    setFeedbackMessage('');
                  } catch (err) {
                    console.error('feedback submit failed', err);
                    setFeedbackStatus('error');
                  } finally {
                    setFeedbackSending(false);
                  }
                }}
              >
                {feedbackSending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}