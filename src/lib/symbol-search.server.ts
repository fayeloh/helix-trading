import { INDEX_CATALOG } from "./constants";
import { readCache, writeCache } from "./market.server";
import { getSecTickerCatalog } from "./sec.server";
import { normalizeSymbol, resolveSymbol } from "./symbol-resolver.server";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export type SymbolSuggestion = {
  symbol: string;
  name: string;
  exchange: string;
  /** 归一化后的市场代码，用于自动填充市场选择。 */
  market: "US" | "HK" | "CN" | "CRYPTO" | "OTHER";
  /** 中文类型标签：股票 / ETF / 指数 / 加密 / 商品 / 其他。 */
  type: string;
};

/** 常见中文名 / 别名 → 代码，便于中文输入直接命中。 */
const ALIASES: { keys: string[]; item: SymbolSuggestion }[] = [
  { keys: ["特斯拉", "tesla"], item: { symbol: "TSLA", name: "Tesla 特斯拉", exchange: "NASDAQ", market: "US", type: "股票" } },
  { keys: ["苹果", "apple"], item: { symbol: "AAPL", name: "Apple 苹果", exchange: "NASDAQ", market: "US", type: "股票" } },
  { keys: ["英伟达", "nvidia"], item: { symbol: "NVDA", name: "NVIDIA 英伟达", exchange: "NASDAQ", market: "US", type: "股票" } },
  { keys: ["微软", "microsoft"], item: { symbol: "MSFT", name: "Microsoft 微软", exchange: "NASDAQ", market: "US", type: "股票" } },
  { keys: ["谷歌", "google", "alphabet"], item: { symbol: "GOOGL", name: "Alphabet 谷歌", exchange: "NASDAQ", market: "US", type: "股票" } },
  { keys: ["亚马逊", "amazon"], item: { symbol: "AMZN", name: "Amazon 亚马逊", exchange: "NASDAQ", market: "US", type: "股票" } },
  { keys: ["台积电", "tsmc"], item: { symbol: "TSM", name: "台积电 ADR", exchange: "NYSE", market: "US", type: "股票" } },
  { keys: ["腾讯", "tencent"], item: { symbol: "0700.HK", name: "腾讯控股", exchange: "HKEX", market: "HK", type: "股票" } },
  { keys: ["阿里巴巴", "alibaba"], item: { symbol: "9988.HK", name: "阿里巴巴-W", exchange: "HKEX", market: "HK", type: "股票" } },
  { keys: ["小米", "xiaomi"], item: { symbol: "1810.HK", name: "小米集团-W", exchange: "HKEX", market: "HK", type: "股票" } },
  { keys: ["美团", "meituan"], item: { symbol: "3690.HK", name: "美团-W", exchange: "HKEX", market: "HK", type: "股票" } },
  { keys: ["比亚迪", "byd"], item: { symbol: "1211.HK", name: "比亚迪股份", exchange: "HKEX", market: "HK", type: "股票" } },
  { keys: ["比特币", "bitcoin", "btc"], item: { symbol: "BTC-USD", name: "比特币 Bitcoin", exchange: "CRYPTO", market: "CRYPTO", type: "加密" } },
  { keys: ["以太坊", "ethereum", "eth"], item: { symbol: "ETH-USD", name: "以太坊 Ethereum", exchange: "CRYPTO", market: "CRYPTO", type: "加密" } },
];

const GROUP_TYPE: Record<string, string> = {
  股指: "指数",
  加密: "加密",
  商品: "商品",
  宏观: "宏观",
  个股: "股票",
};

function groupMarket(group: string, symbol: string): SymbolSuggestion["market"] {
  if (group === "加密") return "CRYPTO";
  if (/\.HK$/i.test(symbol)) return "HK";
  if (/\.(SS|SZ)$/i.test(symbol)) return "CN";
  if (group === "个股") return "US";
  return "OTHER";
}

/** 本地候选：指数看板目录 + 中文别名，离线可用且覆盖中文名。 */
function localMatches(q: string): SymbolSuggestion[] {
  const lower = q.toLowerCase();
  const out: SymbolSuggestion[] = [];

  for (const a of ALIASES) {
    if (a.keys.some((k) => k.includes(lower) || lower.includes(k))) out.push(a.item);
  }
  for (const it of CN_HK_CATALOG) {
    if (it.symbol.toLowerCase().includes(lower) || it.name.toLowerCase().includes(lower)) out.push(it);
  }
  for (const it of numericGuesses(q)) out.push(it);
  for (const it of INDEX_CATALOG) {
    if (it.symbol.toLowerCase().includes(lower) || it.label.toLowerCase().includes(lower)) {
      out.push({
        symbol: it.symbol,
        name: it.label,
        exchange: it.group,
        market: groupMarket(it.group, it.symbol),
        type: GROUP_TYPE[it.group] ?? "其他",
      });
    }
  }
  return out;
}


/** 港股 / A 股常见标的（补足公开搜索接口对这两个市场的覆盖不足）。 */
const CN_HK_CATALOG: SymbolSuggestion[] = [
  { symbol: "0700.HK", name: "腾讯控股 Tencent", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "9988.HK", name: "阿里巴巴-W Alibaba", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "3690.HK", name: "美团-W Meituan", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "1810.HK", name: "小米集团-W Xiaomi", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "1211.HK", name: "比亚迪股份 BYD", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "9618.HK", name: "京东集团-SW JD.com", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "9999.HK", name: "网易-S NetEase", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "2318.HK", name: "中国平安 Ping An", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "0939.HK", name: "建设银行 CCB", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "0941.HK", name: "中国移动 China Mobile", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "1299.HK", name: "友邦保险 AIA", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "2020.HK", name: "安踏体育 Anta", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "0388.HK", name: "香港交易所 HKEX", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "1024.HK", name: "快手-W Kuaishou", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "2269.HK", name: "药明生物 WuXi Bio", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "3888.HK", name: "金山软件 Kingsoft", exchange: "HKEX", market: "HK", type: "股票" },
  { symbol: "600519.SS", name: "贵州茅台 Kweichow Moutai", exchange: "SSE", market: "CN", type: "股票" },
  { symbol: "601318.SS", name: "中国平安 A 股", exchange: "SSE", market: "CN", type: "股票" },
  { symbol: "600036.SS", name: "招商银行 CMB", exchange: "SSE", market: "CN", type: "股票" },
  { symbol: "601899.SS", name: "紫金矿业 Zijin Mining", exchange: "SSE", market: "CN", type: "股票" },
  { symbol: "600030.SS", name: "中信证券 CITIC Securities", exchange: "SSE", market: "CN", type: "股票" },
  { symbol: "688981.SS", name: "中芯国际 SMIC A 股", exchange: "SSE", market: "CN", type: "股票" },
  { symbol: "000858.SZ", name: "五粮液 Wuliangye", exchange: "SZSE", market: "CN", type: "股票" },
  { symbol: "300750.SZ", name: "宁德时代 CATL", exchange: "SZSE", market: "CN", type: "股票" },
  { symbol: "002594.SZ", name: "比亚迪 A 股 BYD", exchange: "SZSE", market: "CN", type: "股票" },
  { symbol: "000333.SZ", name: "美的集团 Midea", exchange: "SZSE", market: "CN", type: "股票" },
  { symbol: "000001.SZ", name: "平安银行 Ping An Bank", exchange: "SZSE", market: "CN", type: "股票" },
];

/**
 * 纯数字输入的市场推断：
 * 4-5 位 → 港股（补零到 4 位 + .HK）；6 位以 6/5 开头 → 上交所；以 0/3 开头 → 深交所。
 */
function numericGuesses(q: string): SymbolSuggestion[] {
  if (!/^\d{3,6}$/.test(q)) return [];
  const out: SymbolSuggestion[] = [];
  if (q.length <= 5) {
    const hk = q.padStart(4, "0");
    out.push({ symbol: `${hk}.HK`, name: `港股代码 ${hk}`, exchange: "HKEX", market: "HK", type: "股票" });
  }
  if (q.length === 6) {
    const suffix = /^[65]/.test(q) ? "SS" : /^[03]/.test(q) ? "SZ" : null;
    if (suffix) {
      out.push({
        symbol: `${q}.${suffix}`,
        name: `${suffix === "SS" ? "上交所" : "深交所"}代码 ${q}`,
        exchange: suffix === "SS" ? "SSE" : "SZSE",
        market: "CN",
        type: "股票",
      });
    }
  }
  return out;
}

/** 远端候选：Yahoo Finance 搜索（覆盖港股 / A 股 / ETF / 加密）。异常或限流时返回空数组。 */
async function yahooMatches(q: string): Promise<SymbolSuggestion[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      q,
    )}&quotesCount=10&newsCount=0&listsCount=0`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      quotes?: { symbol?: string; shortname?: string; longname?: string; exchDisp?: string; quoteType?: string }[];
    };
    const TYPE: Record<string, string> = {
      EQUITY: "股票",
      ETF: "ETF",
      INDEX: "指数",
      CRYPTOCURRENCY: "加密",
      MUTUALFUND: "基金",
      FUTURE: "商品",
      CURRENCY: "外汇",
    };
    return (json.quotes ?? [])
      .filter((r) => typeof r.symbol === "string" && r.symbol.length > 0)
      .map((r) => {
        const symbol = r.symbol!;
        const market: SymbolSuggestion["market"] = /\.HK$/i.test(symbol)
          ? "HK"
          : /\.(SS|SZ)$/i.test(symbol)
            ? "CN"
            : r.quoteType === "CRYPTOCURRENCY"
              ? "CRYPTO"
              : /\./.test(symbol)
                ? "OTHER"
                : "US";
        return {
          symbol,
          name: r.shortname ?? r.longname ?? symbol,
          exchange: r.exchDisp ?? "",
          market,
          type: TYPE[r.quoteType ?? ""] ?? "其他",
        };
      });
  } catch {
    return [];
  }
}

/** SEC 官方目录作为美股搜索的免密钥降级源，特别适合新股与冷门股。 */
async function secMatches(q: string): Promise<SymbolSuggestion[]> {
  if (!/^[\w. -]+$/i.test(q)) return [];
  const needle = q.trim().toUpperCase();
  try {
    const catalog = await getSecTickerCatalog();
    return catalog
      .filter((row) => row.ticker.startsWith(needle) || row.name.toUpperCase().includes(needle))
      .sort((a, b) => {
        const aExact = a.ticker === needle ? 0 : 1;
        const bExact = b.ticker === needle ? 0 : 1;
        return aExact - bExact || a.ticker.length - b.ticker.length;
      })
      .slice(0, 8)
      .map((row) => ({
        symbol: row.ticker,
        name: row.name,
        exchange: "SEC",
        market: "US" as const,
        type: "股票",
      }));
  } catch {
    return [];
  }
}

function mapExchange(symbol: string, exchange: string): { symbol: string; market: SymbolSuggestion["market"]; type: string } {
  const ex = (exchange ?? "").toUpperCase();
  if (ex === "CRYPTO") {
    const base = symbol.replace(/\.X$/i, "");
    return { symbol: `${base}-USD`, market: "CRYPTO", type: "加密" };
  }
  if (["NASDAQ", "NYSE", "NYSEARCA", "AMEX", "OTC", "BATS", "NYSEMKT"].includes(ex)) {
    return { symbol, market: "US", type: "股票" };
  }
  if (ex === "HKEX" || /\.HK$/i.test(symbol)) return { symbol, market: "HK", type: "股票" };
  if (/\.(SS|SZ)$/i.test(symbol)) return { symbol, market: "CN", type: "股票" };
  return { symbol, market: "OTHER", type: "其他" };
}

/** 远端候选：Stocktwits 公开搜索（免密钥）。异常时返回空数组。 */
async function remoteMatches(q: string): Promise<SymbolSuggestion[]> {
  try {
    const url = `https://api.stocktwits.com/api/2/search/symbols.json?q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: { symbol?: string; title?: string; exchange?: string }[];
    };
    return (json.results ?? [])
      .filter((r) => typeof r.symbol === "string" && r.symbol.length > 0)
      .filter((r) => (r.exchange ?? "").toUpperCase() !== "MISC")
      .map((r) => {
        const m = mapExchange(r.symbol!, r.exchange ?? "");
        return {
          symbol: m.symbol,
          name: r.title ?? m.symbol,
          exchange: r.exchange ?? "",
          market: m.market,
          type: m.type,
        };
      });
  } catch {
    return [];
  }
}

/**
 * 标的代码联想：本地目录 + 中文别名优先，再补公开搜索接口结果。
 * 结果缓存 24 小时；数据源异常时静默降级为本地结果，不抛错（联想不应打断输入）。
 */
export async function searchSymbols(query: string): Promise<SymbolSuggestion[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const cacheKey = `symbol_search_v4_${q.toLowerCase()}`;
  try {
    const cached = await readCache<SymbolSuggestion[]>(cacheKey);
    if (cached) return cached;
  } catch {
    // 缓存不可用时直接走网络。
  }

  const local = localMatches(q);
  const normalizedCandidates = new Set([q]);
  if (/^\d{3,6}$/.test(q)) {
    if (q.length <= 5) normalizedCandidates.add(normalizeSymbol(q, "HK"));
    if (q.length === 6) normalizedCandidates.add(normalizeSymbol(q, "CN"));
  }
  const queries = [...normalizedCandidates];
  const [yahooGroups, remote, sec, direct] = await Promise.all([
    Promise.all(queries.map((candidate) => yahooMatches(candidate))),
    remoteMatches(q),
    secMatches(q),
    /^[A-Za-z][A-Za-z0-9.-]{0,9}$/.test(q)
      ? resolveSymbol(q, "US").catch(() => null)
      : Promise.resolve(null),
  ]);
  const yahoo = yahooGroups.flat();
  const directSuggestion: SymbolSuggestion[] =
    direct?.verified && direct.name
      ? [{ symbol: direct.symbol, name: direct.name, exchange: direct.exchange ?? "", market: direct.market, type: direct.type }]
      : [];

  const seen = new Set<string>();
  const items: SymbolSuggestion[] = [];
  for (const it of [...local, ...directSuggestion, ...sec, ...yahoo, ...remote]) {
    const key = it.symbol.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(it);
    if (items.length >= 10) break;
  }

  if (items.length > 0) {
    try {
      await writeCache(cacheKey, items, 24 * 60 * 60);
    } catch {
      // 缓存写入失败不影响联想结果。
    }
  }
  return items;
}
