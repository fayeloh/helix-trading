import { convert } from "./constants";

export type Holding = {
  id: string;
  account_id: string;
  symbol: string;
  display_name: string | null;
  market: string;
  currency: string;
  quantity: number;
  avg_cost: number;
  sector: string | null;
  industry_tags: string[];
  notes: string | null;
};

export type Quote = { price: number | null; currency: string | null; changePct: number | null };

export type HoldingMetrics = Holding & {
  price: number | null;
  changePct: number | null;
  costBase: number;
  marketValue: number | null;
  pnl: number | null;
  pnlPct: number | null;
  weightPct: number | null;
};

export type PortfolioSummary = {
  rows: HoldingMetrics[];
  totalCost: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  sectors: { name: string; value: number; pct: number }[];
  markets: { name: string; value: number; pct: number }[];
  priced: number;
  unpriced: number;
};

export function buildPortfolio(
  holdings: Holding[],
  quotes: Record<string, Quote>,
  baseCurrency: string,
): PortfolioSummary {
  const rows: HoldingMetrics[] = holdings.map((h) => {
    const q = quotes[h.symbol];
    const price = q?.price ?? null;
    const costBase = convert(h.quantity * h.avg_cost, h.currency, baseCurrency);
    const marketValue = price == null ? null : convert(h.quantity * price, h.currency, baseCurrency);
    const pnl = marketValue == null ? null : marketValue - costBase;
    return {
      ...h,
      price,
      changePct: q?.changePct ?? null,
      costBase,
      marketValue,
      pnl,
      pnlPct: pnl == null || costBase === 0 ? null : (pnl / costBase) * 100,
      weightPct: null,
    };
  });

  const totalValue = rows.reduce((sum, r) => sum + (r.marketValue ?? 0), 0);
  const totalCost = rows.reduce((sum, r) => sum + r.costBase, 0);

  for (const r of rows) {
    r.weightPct = totalValue > 0 && r.marketValue != null ? (r.marketValue / totalValue) * 100 : null;
  }

  const group = (key: (r: HoldingMetrics) => string) => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(key(r), (map.get(key(r)) ?? 0) + (r.marketValue ?? 0));
    return [...map.entries()]
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  };

  const totalPnl = totalValue - totalCost;
  return {
    rows: rows.sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0)),
    totalCost,
    totalValue,
    totalPnl,
    totalPnlPct: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
    sectors: group((r) => r.sector || "未标注板块"),
    markets: group((r) => r.market),
    priced: rows.filter((r) => r.price != null).length,
    unpriced: rows.filter((r) => r.price == null).length,
  };
}

export function fmtMoney(value: number | null, currency = "USD"): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function fmtPct(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

export function fmtNum(value: number | null, digits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(value);
}

export function toneClass(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "text-muted-foreground";
  if (value > 0) return "text-bull";
  if (value < 0) return "text-bear";
  return "text-muted-foreground";
}

/** Parse a holdings CSV. Accepts Chinese or English headers. */
export function parseHoldingsCsv(text: string): {
  rows: {
    symbol: string;
    display_name: string;
    market: string;
    currency: string;
    quantity: number;
    avg_cost: number;
    sector: string;
  }[];
  errors: string[];
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ["CSV 至少需要表头与一行数据"] };

  const split = (line: string) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const header = split(lines[0]!).map((h) => h.toLowerCase());
  const idx = (...names: string[]) => header.findIndex((h) => names.includes(h));

  const iSymbol = idx("symbol", "代码", "ticker");
  const iName = idx("name", "display_name", "名称");
  const iMarket = idx("market", "市场");
  const iCurrency = idx("currency", "币种");
  const iQty = idx("quantity", "qty", "数量", "shares");
  const iCost = idx("avg_cost", "cost", "成本", "均价");
  const iSector = idx("sector", "板块", "行业");

  if (iSymbol < 0 || iQty < 0 || iCost < 0) {
    return {
      rows: [],
      errors: ["缺少必需列：symbol/代码、quantity/数量、avg_cost/成本"],
    };
  }

  const rows: ReturnType<typeof parseHoldingsCsv>["rows"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = split(lines[i]!);
    const symbol = (cells[iSymbol] ?? "").toUpperCase();
    const quantity = Number(cells[iQty]);
    const avgCost = Number(cells[iCost]);
    if (!symbol) {
      errors.push(`第 ${i + 1} 行：代码为空，已跳过`);
      continue;
    }
    if (!Number.isFinite(quantity) || !Number.isFinite(avgCost)) {
      errors.push(`第 ${i + 1} 行（${symbol}）：数量或成本不是数字，已跳过`);
      continue;
    }
    const rawMarket = (iMarket >= 0 ? cells[iMarket] : "")?.toUpperCase() ?? "";
    const market = ["US", "HK", "CN", "CRYPTO", "OTHER"].includes(rawMarket)
      ? rawMarket
      : symbol.endsWith(".HK")
        ? "HK"
        : /^(BTC|ETH|SOL|XRP|DOGE|ADA|BNB)$/.test(symbol)
          ? "CRYPTO"
          : "US";
    const currency =
      (iCurrency >= 0 ? cells[iCurrency]?.toUpperCase() : "") ||
      (market === "HK" ? "HKD" : market === "CN" ? "CNY" : "USD");

    rows.push({
      symbol,
      display_name: (iName >= 0 ? cells[iName] : "") ?? "",
      market,
      currency,
      quantity,
      avg_cost: avgCost,
      sector: (iSector >= 0 ? cells[iSector] : "") ?? "",
    });
  }
  return { rows, errors };
}

export const CSV_TEMPLATE =
  "symbol,name,market,currency,quantity,avg_cost,sector\nAAPL,Apple,US,USD,50,182.35,信息技术\n0700.HK,腾讯控股,HK,HKD,200,368.4,通讯服务\nBTC,Bitcoin,CRYPTO,USD,0.35,58200,加密货币\n";
