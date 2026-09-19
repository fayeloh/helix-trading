import { readCache, writeCache } from "./market.server";
import { secJson, secText, tickerToCik } from "./sec.server";

/**
 * 真实资金流记录：只放可核实的公开申报 / 链上数据。
 * 抓不到就返回空数组 + gaps 说明，绝不填推测值。
 */
export type FlowRecord = {
  entity: string;
  entity_type: "institution_13f" | "insider_form4" | "whale_onchain";
  side: "buy" | "sell" | "unknown";
  date: string | null;
  shares_or_amount: string | null;
  price: string | null;
  total_value: string | null;
  source: string;
  source_url: string | null;
  filed_at: string | null;
  note: string | null;
};

export type FlowFacts = { records: FlowRecord[]; gaps: string[] };

const YF_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function tag(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}>\\s*([^<]*)\\s*</${name}>`).exec(xml);
  const v = m?.[1]?.trim();
  return v ? v : null;
}

function valueOf(block: string, name: string): string | null {
  const m = new RegExp(`<${name}>[\\s\\S]*?<value>\\s*([^<]*)\\s*</value>`).exec(block);
  const v = m?.[1]?.trim();
  return v ? v : null;
}

const CODE_NOTE: Record<string, string> = {
  P: "市价买入",
  S: "市价卖出",
  M: "期权行权转换",
  A: "股权激励授予",
  F: "缴税代扣股份",
  G: "赠与",
  C: "转换",
  X: "行权",
};

function fmtNum(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** 美股内部人交易：SEC EDGAR Form 4（免密钥）。 */
async function fetchForm4(ticker: string, limit = 6): Promise<FlowRecord[]> {
  const cik = await tickerToCik(ticker);
  if (!cik) return [];

  const sub = await secJson<{
    filings?: {
      recent?: {
        form?: string[];
        filingDate?: string[];
        accessionNumber?: string[];
        primaryDocument?: string[];
      };
    };
  }>(`https://data.sec.gov/submissions/CIK${cik}.json`);

  const recent = sub?.filings?.recent;
  if (!recent?.form) return [];

  const picks: { acc: string; doc: string; filed: string }[] = [];
  for (let i = 0; i < recent.form.length && picks.length < limit; i++) {
    if (recent.form[i] !== "4") continue;
    const acc = recent.accessionNumber?.[i];
    const doc = recent.primaryDocument?.[i];
    if (!acc || !doc) continue;
    picks.push({ acc: acc.replace(/-/g, ""), doc: doc.replace(/^xslF345X\d+\//, ""), filed: recent.filingDate?.[i] ?? "" });
  }

  const cikNum = String(Number(cik));
  const out: FlowRecord[] = [];
  for (const p of picks) {
    const base = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${p.acc}`;
    const xml = await secText(`${base}/${p.doc}`);
    if (!xml) continue;

    const owner = tag(xml, "rptOwnerName") ?? "未披露申报人";
    const title =
      tag(xml, "officerTitle") ??
      (tag(xml, "isDirector") === "1" ? "董事" : tag(xml, "isTenPercentOwner") === "1" ? "10% 以上股东" : null);

    const blocks = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g) ?? [];
    for (const b of blocks.slice(0, 2)) {
      const shares = valueOf(b, "transactionShares");
      const price = valueOf(b, "transactionPricePerShare");
      const ad = valueOf(b, "transactionAcquiredDisposedCode");
      const code = tag(b, "transactionCode");
      const date = valueOf(b, "transactionDate");
      const sharesN = shares ? Number(shares) : null;
      const priceN = price ? Number(price) : null;
      out.push({
        entity: title ? `${owner}（${title}）` : owner,
        entity_type: "insider_form4",
        side: ad === "A" ? "buy" : ad === "D" ? "sell" : "unknown",
        date: date ?? p.filed ?? null,
        shares_or_amount: sharesN ? `${fmtNum(sharesN)} 股` : null,
        price: priceN ? `$${fmtNum(priceN)}` : null,
        total_value: sharesN && priceN ? `$${fmtNum(sharesN * priceN)}` : null,
        source: "SEC EDGAR Form 4",
        source_url: `${base}/${p.doc}`,
        filed_at: p.filed || null,
        note: code ? (CODE_NOTE[code] ?? `交易代码 ${code}`) : null,
      });
    }
  }
  return out;
}

/** 美股机构持仓（13F 汇总，来自公开行情源；限流时返回空）。 */
async function fetchInstitutions(ysym: string): Promise<FlowRecord[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ysym,
    )}?modules=institutionOwnership`;
    const res = await fetch(url, { headers: { "User-Agent": YF_UA, Accept: "application/json" } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      quoteSummary?: {
        result?: {
          institutionOwnership?: {
            ownershipList?: {
              organization?: string;
              reportDate?: { fmt?: string };
              position?: { raw?: number };
              value?: { raw?: number };
              pctHeld?: { raw?: number };
            }[];
          };
        }[];
      };
    };
    const list = json.quoteSummary?.result?.[0]?.institutionOwnership?.ownershipList ?? [];
    return list.slice(0, 6).map((h) => ({
      entity: h.organization ?? "未披露机构",
      entity_type: "institution_13f" as const,
      side: "unknown" as const,
      date: h.reportDate?.fmt ?? null,
      shares_or_amount: h.position?.raw ? `${fmtNum(h.position.raw)} 股` : null,
      price: null,
      total_value: h.value?.raw ? `$${fmtNum(h.value.raw)}` : null,
      source: "13F 机构持仓汇总",
      source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(
        h.organization ?? "",
      )}&type=13F`,
      filed_at: h.reportDate?.fmt ?? null,
      note: h.pctHeld?.raw ? `占流通股 ${(h.pctHeld.raw * 100).toFixed(2)}%` : null,
    }));
  } catch {
    return [];
  }
}

/** BTC 链上大额转账（mempool.space，免密钥）。 */
async function fetchBtcWhales(): Promise<FlowRecord[]> {
  try {
    const res = await fetch("https://mempool.space/api/mempool/recent", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const txs = (await res.json()) as { txid: string; value: number }[];
    return txs
      .filter((t) => typeof t.value === "number" && t.value >= 5 * 1e8)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map((t) => ({
        entity: `链上地址 ${t.txid.slice(0, 10)}…`,
        entity_type: "whale_onchain" as const,
        side: "unknown" as const,
        date: new Date().toISOString().slice(0, 10),
        shares_or_amount: `${fmtNum(t.value / 1e8)} BTC`,
        price: null,
        total_value: null,
        source: "mempool.space 未确认大额转账",
        source_url: `https://mempool.space/tx/${t.txid}`,
        filed_at: new Date().toISOString(),
        note: "链上转账只能确认金额与时间，无法确认地址身份",
      }));
  } catch {
    return [];
  }
}

/** ETH 链上大额转账（Blockscout 公共实例，免密钥）。 */
async function fetchEthWhales(): Promise<FlowRecord[]> {
  try {
    const res = await fetch("https://eth.blockscout.com/api/v2/transactions?filter=validated", {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: { hash?: string; value?: string; timestamp?: string }[] };
    return (json.items ?? [])
      .map((t) => ({ ...t, eth: Number(t.value ?? "0") / 1e18 }))
      .filter((t) => t.hash && t.eth >= 100)
      .sort((a, b) => b.eth - a.eth)
      .slice(0, 5)
      .map((t) => ({
        entity: `链上地址 ${t.hash!.slice(0, 12)}…`,
        entity_type: "whale_onchain" as const,
        side: "unknown" as const,
        date: t.timestamp ? t.timestamp.slice(0, 10) : null,
        shares_or_amount: `${fmtNum(t.eth)} ETH`,
        price: null,
        total_value: null,
        source: "Blockscout 已确认大额转账",
        source_url: `https://eth.blockscout.com/tx/${t.hash}`,
        filed_at: t.timestamp ?? null,
        note: "链上转账只能确认金额与时间，无法确认地址身份",
      }));
  } catch {
    return [];
  }
}

/**
 * 汇总真实资金流事实。美股走 SEC Form 4 + 13F 汇总；加密走链上大额转账；
 * 港股 / A 股无免费结构化申报源，直接返回缺口说明。
 */
export async function getFlowFacts(input: {
  symbol: string;
  ysym: string;
  market: string;
}): Promise<FlowFacts> {
  const cacheKey = `flow_facts_v1_${input.market}_${input.ysym}`;
  try {
    const cached = await readCache<FlowFacts>(cacheKey);
    if (cached) return cached;
  } catch {
    // 缓存不可用时直接取数
  }

  const gaps: string[] = [];
  let records: FlowRecord[] = [];

  if (input.market === "US") {
    const [insiders, institutions] = await Promise.all([
      fetchForm4(input.symbol.replace(/\..*$/, "")),
      fetchInstitutions(input.ysym),
    ]);
    records = [...insiders, ...institutions];
    if (insiders.length === 0) gaps.push("未取到该标的近期 SEC Form 4 内部人申报（可能近期无申报或数据源暂不可用）。");
    if (institutions.length === 0) gaps.push("未取到 13F 机构持仓汇总（数据源限流），13F 本身还有最长 45 天披露滞后。");
  } else if (input.market === "CRYPTO") {
    const base = input.ysym.replace(/-USD$/i, "").toUpperCase();
    if (base === "BTC") records = await fetchBtcWhales();
    else if (base === "ETH") records = await fetchEthWhales();
    else gaps.push(`暂无 ${base} 的免费链上大额转账数据源，仅支持 BTC / ETH。`);
    if (records.length === 0 && (base === "BTC" || base === "ETH")) {
      gaps.push("当前时段未出现达到阈值（5 BTC / 100 ETH）的链上大额转账，或链上数据源暂不可用。");
    }
    gaps.push("链上数据只能确认金额与时间，无法确认地址背后的身份。");
  } else {
    gaps.push("港股 / A 股的持仓与内部人交易披露门槛较高，且无免费结构化申报接口，本模块不提供该市场的具体申报记录。");
  }

  const facts: FlowFacts = { records, gaps };
  if (records.length > 0) {
    try {
      await writeCache(cacheKey, facts, 6 * 60 * 60);
    } catch {
      // 缓存写入失败不影响返回
    }
  }
  return facts;
}
