import { ET_ZONE } from "./time-format";
import { readCache, writeCache } from "./market.server";
import { googleNews, rssFeed, type NewsItem } from "./news.server";
import { translateTitlesToZh } from "./translate.server";
import { aiJson, AI_MODEL_FAST, GUARDRAILS } from "./ai.server";
import { expandBullishSpaceImpact } from "./macro-briefing.space";

import type {
  HeadlineImpact,
  Importance,
  MacroCalendarEvent,
  TopHeadline,
} from "./macro-briefing.types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

/** 任意时刻 → 美东挂钟 `YYYY-MM-DD HH:mm`。 */
export function etStamp(d: Date = new Date()): string {
  const p: Record<string, string> = {};
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  for (const part of dtf.formatToParts(d)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  const hour = p["hour"] === "24" ? "00" : p["hour"];
  return `${p["year"]}-${p["month"]}-${p["day"]} ${hour}:${p["minute"]}`;
}

/** 美东日期 `YYYY-MM-DD`，可按天偏移。 */
export function etDate(offsetDays = 0, d: Date = new Date()): string {
  return etStamp(new Date(d.getTime() + offsetDays * 86400000)).slice(0, 10);
}

const BULLISH = [
  "上涨", "走高", "创新高", "反弹", "超预期", "好于预期", "降息", "增持", "回购", "上调", "扩产", "利好", "大涨", "获批", "获订单", "中标", "成功发射",
  "rise", "rises", "rally", "jump", "jumps", "surge", "surges", "soar", "gains", "beat", "beats",
  "record high", "upgrade", "raises outlook", "buyback", "approval", "rate cut", "contract award", "wins contract", "wins", "secures contract", "successful launch",
];
const BEARISH = [
  "下跌", "下挫", "跌破", "重挫", "不及预期", "低于预期", "加息", "关税", "制裁", "裁员", "下调", "亏损", "违约", "暴跌", "调查", "罢工",
  "fall", "falls", "drop", "drops", "slump", "sink", "sinks", "plunge", "tumble", "miss", "misses",
  "cuts outlook", "downgrade", "layoff", "layoffs", "tariff", "sanction", "probe", "lawsuit",
  "default", "strike", "rate hike", "selloff",
];

/** 依据标题措辞判断方向；两侧都不命中或同时命中时返回中性，不做猜测。 */
export function impactOfTitle(title: string): HeadlineImpact {
  const t = title.toLowerCase();
  const up = BULLISH.filter((k) => t.includes(k.toLowerCase())).length;
  const down = BEARISH.filter((k) => t.includes(k.toLowerCase())).length;
  if (up > down) return "bullish";
  if (down > up) return "bearish";
  return "neutral";
}


const SECTOR_HINTS: { keys: string[]; sector: string }[] = [
  // 太空/航天新闻按产业链整体归类，避免只显示单一公司或火箭标的。
  { keys: ["太空", "航天", "火箭", "卫星", "space", "aerospace", "rocket", "satellite", "SpaceX", "AST SpaceMobile", "Rocket Lab", "Intuitive Machines", "Redwire", "Planet Labs", "Virgin Galactic"], sector: "太空板块" },
  { keys: ["芯片", "半导体", "英伟达", "台积电", "AMD", "chip", "semiconductor", "nvidia", "tsmc"], sector: "半导体" },
  { keys: ["银行", "券商", "保险", "金融", "bank", "broker", "insurer", "financial"], sector: "金融" },
  { keys: ["原油", "石油", "天然气", "OPEC", "能源", "oil", "crude", "gas", "energy"], sector: "能源" },
  { keys: ["黄金", "白银", "贵金属", "gold", "silver", "bullion"], sector: "贵金属" },
  { keys: ["药", "医疗", "生物", "pharma", "drug", "health", "biotech", "fda"], sector: "医疗保健" },
  { keys: ["汽车", "新能源车", "电动车", "特斯拉", "比亚迪", "auto", "ev ", "tesla", "byd"], sector: "汽车与新能源" },
  { keys: ["房地产", "地产", "楼市", "housing", "real estate", "mortgage"], sector: "房地产" },
  { keys: ["消费", "零售", "餐饮", "retail", "consumer", "restaurant"], sector: "消费" },
  { keys: ["比特币", "以太", "加密", "bitcoin", "ether", "crypto"], sector: "加密货币" },
  { keys: ["AI", "人工智能", "算力", "云", "artificial intelligence", "cloud", "data center"], sector: "科技与AI" },
];


function sectorsOfTitle(title: string): string[] {
  const out: string[] = [];
  for (const h of SECTOR_HINTS) {
    if (h.keys.some((k) => title.toLowerCase().includes(k.toLowerCase())) && !out.includes(h.sector)) {
      out.push(h.sector);
    }
  }
  return out.slice(0, 3);
}

const TICKER_HINTS: { keys: string[]; ticker: string }[] = [
  { keys: ["英伟达", "NVIDIA"], ticker: "NVDA" },
  { keys: ["苹果", "Apple"], ticker: "AAPL" },
  { keys: ["特斯拉", "Tesla"], ticker: "TSLA" },
  { keys: ["微软", "Microsoft"], ticker: "MSFT" },
  { keys: ["亚马逊", "Amazon"], ticker: "AMZN" },
  { keys: ["谷歌", "Alphabet"], ticker: "GOOGL" },
  { keys: ["台积电", "TSMC"], ticker: "TSM" },
  { keys: ["腾讯"], ticker: "0700.HK" },
  { keys: ["阿里巴巴", "阿里"], ticker: "9988.HK" },
  { keys: ["小米"], ticker: "1810.HK" },
  { keys: ["比亚迪"], ticker: "1211.HK" },
  { keys: ["比特币", "Bitcoin", "BTC"], ticker: "BTC-USD" },
  { keys: ["以太坊", "Ethereum", "ETH"], ticker: "ETH-USD" },
];

function tickersOfTitle(title: string): string[] {
  const out: string[] = [];
  for (const h of TICKER_HINTS) {
    if (h.keys.some((k) => title.toLowerCase().includes(k.toLowerCase())) && !out.includes(h.ticker)) {
      out.push(h.ticker);
    }
  }
  return out.slice(0, 4);
}

type HeadlineAnalysis = {
  sectors: string[];
  reasoning: string;
};

/**
 * 用可审计的金融传导链补足标题词频判断：事件 → 利率/成本/需求 → 板块。
 * 只在标题明确命中规则时推演，命中不到时保持保守，不把相关性写成确定性因果。
 */
function analyzeHeadline(title: string, impact: HeadlineImpact, initialSectors: string[]): HeadlineAnalysis {
  const t = title.toLowerCase();
  const sectors = [...initialSectors];
  const add = (...values: string[]) => {
    for (const value of values) if (!sectors.includes(value)) sectors.push(value);
  };
  let reasoning = "标题方向明确，但缺少足够信息拆解传导链，先按直接相关板块观察。";

  if (/(降息|减息|rate cut|dovish|lower rates)/i.test(title)) {
    add("科技与AI", "房地产", "贵金属", "金融");
    reasoning = "降息压低无风险利率与融资成本，通常利多科技与AI、房地产及贵金属；同时关注银行净息差，金融板块相对承压。";
  } else if (/(加息|升息|rate hike|hawkish|higher rates)/i.test(title)) {
    add("金融", "科技与AI", "房地产", "贵金属");
    reasoning = "加息抬升贴现率与融资成本，通常利多金融的利差预期；高估值科技与AI、房地产及贵金属的估值承压。";
  } else if (/(油价|原油|wti|布伦特|天然气|oil|crude|energy)/i.test(title) &&
    /(上涨|走高|大涨|飙升|新高|surge|jump|rally|rise)/i.test(title)) {
    add("能源", "航空与运输", "消费");
    reasoning = "能源价格上行改善上游资源品收入，但会推高航空运输与消费企业的燃料/物流成本，形成板块间分化。";
  } else if (/(油价|原油|wti|布伦特|天然气|oil|crude|energy)/i.test(title) &&
    /(下跌|下挫|重挫|暴跌|走低|drop|slump|fall|plunge)/i.test(title)) {
    add("能源", "航空与运输", "消费");
    reasoning = "能源价格回落压低上游收入预期，但缓解航空运输与消费企业的成本压力，受益方向与能源板块相反。";
  } else if (/(关税|制裁|出口管制|禁令|tariff|sanction|export control)/i.test(title)) {
    add("出口链", "消费");
    reasoning = "关税、制裁或出口管制提高跨境交易摩擦与供应链不确定性，通常利空出口链和可选消费；需进一步确认豁免范围与替代供应。";
  } else if (/(通胀|cpi|pce|ppi|inflation)/i.test(title)) {
    add("金融", "科技与AI", "房地产", "贵金属");
    reasoning = "通胀数据改变利率路径定价：若高于预期，利率敏感的科技与AI、房地产及贵金属承压，金融相对受益；若低于预期则方向反转。";
  } else if (/(ai|人工智能|算力|云|data center|artificial intelligence)/i.test(title)) {
    add("科技与AI", "半导体");
    reasoning = "AI/算力需求变化先影响云计算与数据中心资本开支，再沿订单链传导至半导体；同时观察资本开支是否挤压下游利润。";
  } else if (impact !== "neutral") {
    reasoning = `标题包含偏${impact === "bullish" ? "正面" : "负面"}表述，先对直接相关板块形成${impact === "bullish" ? "利多" : "利空"}；持续性取决于后续数据、指引与估值定价。`;
  }

  return { sectors: sectors.slice(0, 6), reasoning };
}

function toHeadline(n: NewsItem, zhTitle?: string): TopHeadline | null {
  if (!n.title) return null;
  const display = zhTitle?.trim() || n.title;
  // 方向与板块识别同时基于中英文文本，翻译成功与否都能命中。
  const matchText = `${display} ${n.title}`;
  const impact = impactOfTitle(matchText);
  const analysis = analyzeHeadline(matchText, impact, sectorsOfTitle(matchText));
  const time = n.publishedAt ? etStamp(new Date(n.publishedAt)) : etStamp();
  return expandBullishSpaceImpact({
    headline: display,
    ...(display !== n.title ? { headline_original: n.title } : {}),
    source: n.source,
    time,
    impact,
    affected_sectors: analysis.sectors,
    affected_tickers: [...tickersOfTitle(matchText), ...(n.related ?? [])].slice(0, 5),
    reasoning: impact === "neutral" ? "标题措辞未给出明确方向，需等待后续数据或公司确认。" : analysis.reasoning,
    ...(n.url ? { url: n.url } : {}),
  });
}

/** 重要性关键词权重：宏观政策与权重股优先（中英文均可命中）。 */
const IMPORTANCE_WEIGHTS: { test: RegExp; score: number }[] = [
  { test: /(太空|航天|火箭|卫星|space\b|aerospace\b|rocket\b|satellite\b|orbital\b|spaceflight\b|SpaceX|AST SpaceMobile|Rocket Lab|Intuitive Machines|Redwire|Planet Labs|Virgin Galactic)/i, score: 5 },
  { test: /(美联储|FOMC|议息|加息|降息|鲍威尔|央行|利率决议|federal reserve|\bfed\b|rate (cut|hike|decision)|central bank)/i, score: 6 },
  { test: /(CPI|PCE|PPI|通胀|非农|失业率|GDP|就业|inflation|payroll|jobless|unemployment)/i, score: 5 },
  { test: /(关税|制裁|出口管制|贸易战|地缘|战争|tariff|sanction|export control|trade war|war\b)/i, score: 4 },
  { test: /(财报|业绩|营收|净利|指引|超预期|不及预期|earnings|revenue|guidance|profit|beats|misses)/i, score: 3 },
  { test: /(英伟达|苹果|特斯拉|微软|台积电|亚马逊|谷歌|腾讯|阿里|nvidia|apple|tesla|microsoft|amazon|alphabet|tsmc|tencent|alibaba)/i, score: 3 },
  { test: /(标普|纳斯达克|道琼斯|恒生|上证|比特币|黄金|原油|s&p|nasdaq|dow|hang seng|bitcoin|gold|oil)/i, score: 2 },
];


/** 单条新闻重要性得分（关键词加权 + 新鲜度）。 */
export function headlineImportance(h: TopHeadline, newestDate: string): number {
  const text = `${h.headline} ${h.headline_original ?? ""}`;
  let score = 0;
  for (const w of IMPORTANCE_WEIGHTS) if (w.test.test(text)) score += w.score;
  if (h.impact !== "neutral") score += 1;
  score += Math.min(2, h.affected_tickers.length * 0.5);
  if (h.time.slice(0, 10) === newestDate) score += 3;
  return score;
}

/** 只保留最新一天的新闻；不足 n 条时按时间回补更早的。 */
export function pickTopHeadlines(items: TopHeadline[], limit: number): TopHeadline[] {
  if (!items.length) return [];
  const sortedByTime = [...items].sort((a, b) => b.time.localeCompare(a.time));
  const newestDate = sortedByTime[0]!.time.slice(0, 10);
  const rank = (list: TopHeadline[]) =>
    [...list].sort(
      (a, b) =>
        headlineImportance(b, newestDate) - headlineImportance(a, newestDate) ||
        b.time.localeCompare(a.time),
    );
  const today = rank(sortedByTime.filter((h) => h.time.slice(0, 10) === newestDate));
  if (today.length >= limit) return today.slice(0, limit);
  const older = rank(sortedByTime.filter((h) => h.time.slice(0, 10) !== newestDate));
  return [...today, ...older].slice(0, limit);
}

/**
 * 头条实时源（云端 Worker 可直连，按可靠性排序）。
 * Google News RSS 在服务端常被拦截，只作为补充。
 */
const HEADLINE_FEEDS: { url: string; source: string; limit: number }[] = [
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", source: "CNBC", limit: 12 },
  { url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", source: "CNBC 经济", limit: 10 },
  { url: "https://www.cnbc.com/id/10000664/device/rss/rss.html", source: "CNBC 市场", limit: 10 },
  { url: "https://www.investing.com/rss/news_25.rss", source: "Investing.com", limit: 10 },
  { url: "https://finance.yahoo.com/news/rssindex", source: "Yahoo Finance", limit: 12 },
];

/**
 * 实时头条：多源 RSS 聚合 + AI 中文标题翻译，保留真实发布时间与原文链接。
 * 全部源失败时抛错，交由调用方决定是否降级，避免把空结果缓存成「暂不可用」。
 */
export async function getLiveHeadlines(limit = 5): Promise<TopHeadline[]> {
  const cacheKey = "macro_headlines_live_v4";
  const cached = await readCache<TopHeadline[]>(cacheKey);
  if (cached?.length) return cached;

  const batches = await Promise.all([
    ...HEADLINE_FEEDS.map((f) =>
      rssFeed(f.url, f.source, f.limit).catch((): NewsItem[] => []),
    ),
    googleNews("美股 财经 头条", "zh-CN", 8).catch((): NewsItem[] => []),
  ]);

  const seen = new Set<string>();
  const raw: NewsItem[] = [];
  for (const n of batches.flat()) {
    const key = n.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "").slice(0, 40);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    raw.push(n);
  }
  if (!raw.length) throw new Error("实时头条源暂时无返回");

  // 先按重要性挑选，再只翻译入选的标题，控制 AI 成本。
  const scored = raw
    .map((n) => ({ n, h: toHeadline(n) }))
    .filter((x): x is { n: NewsItem; h: TopHeadline } => !!x.h);
  const picked = pickTopHeadlines(
    scored.map((x) => x.h),
    limit,
  );
  const pickedRaw = picked.map(
    (h) => scored.find((x) => x.h.headline === h.headline)?.n,
  );
  const zh = await translateTitlesToZh(pickedRaw.map((n) => n?.title ?? ""));

  const out = picked
    .map((h, i) => {
      const n = pickedRaw[i];
      return n ? toHeadline(n, zh[i]) : h;
    })
    .filter((h): h is TopHeadline => !!h);

  if (out.length) await writeCache(cacheKey, out, 60);
  return out;
}


const HIGH_EVENT =
  /(CPI|PPI|PCE|GDP|Nonfarm|Non-Farm|Payroll|FOMC|Fed |Interest Rate|Unemployment|Retail Sales|Jobless)/i;

type NasdaqEconRow = {
  gmt?: string;
  country?: string;
  eventName?: string;
  consensus?: string;
  previous?: string;
};

type NasdaqEarningsRow = {
  time?: string;
  symbol?: string;
  name?: string;
  marketCap?: string;
  epsForecast?: string;
};

async function nasdaqJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function importanceOfEvent(row: NasdaqEconRow): Importance {
  const name = row.eventName ?? "";
  const isUs = (row.country ?? "").toLowerCase().includes("united states");
  if (isUs && HIGH_EVENT.test(name)) return "high";
  if (isUs) return "medium";
  return "low";
}

function parseCap(raw?: string): number {
  const n = Number((raw ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** 未来 48 小时宏观日历：Nasdaq 经济数据日历 + 财报日历（真实时间，美东口径）。 */
export async function getLiveCalendar(limit = 12): Promise<MacroCalendarEvent[]> {
  const cacheKey = "macro_calendar_live_v2";
  const cached = await readCache<MacroCalendarEvent[]>(cacheKey);
  if (cached?.length) return cached;

  // 只拉取当前时刻之后的一周，随后仅保留高重要性事件，避免把已过事件混入日历。
  const days = Array.from({ length: 8 }, (_, i) => etDate(i));
  const nowEt = etStamp();

  const econPages = await Promise.all(
    days.map((d) =>
      nasdaqJson<{ data?: { rows?: NasdaqEconRow[] } }>(
        `https://api.nasdaq.com/api/calendar/economicevents?date=${d}`,
      ).then((j) => ({ date: d, rows: j?.data?.rows ?? [] })),
    ),
  );
  const earnPages = await Promise.all(
    days.map((d) =>
      nasdaqJson<{ data?: { rows?: NasdaqEarningsRow[] } }>(
        `https://api.nasdaq.com/api/calendar/earnings?date=${d}`,
      ).then((j) => ({ date: d, rows: j?.data?.rows ?? [] })),
    ),
  );

  const out: MacroCalendarEvent[] = [];

  for (const page of econPages) {
    for (const row of page.rows) {
      const name = row.eventName?.trim();
      const hhmm = /^\d{2}:\d{2}$/.test(row.gmt ?? "") ? row.gmt! : null;
      if (!name || !hhmm) continue;
      const time = `${page.date} ${hhmm}`;
      if (time < nowEt) continue;
      const label = row.country && !row.country.toLowerCase().includes("united states")
        ? `${row.country} · ${name}`
        : name;
      out.push({
        event: row.consensus ? `${label}（市场预期 ${row.consensus}）` : label,
        time,
        importance: importanceOfEvent(row),
        impact: "neutral",
        affected_sectors: [],
        impact_reasoning: "事件尚未公布，等待实际值与市场预期的差异。",
        is_forecast: true,
        url: "https://www.nasdaq.com/market-activity/economic-calendar",
      });
    }
  }

  for (const page of earnPages) {
    const rows = [...page.rows].sort((a, b) => parseCap(b.marketCap) - parseCap(a.marketCap)).slice(0, 4);
    for (const row of rows) {
      if (!row.symbol) continue;
      const afterHours = (row.time ?? "").includes("after");
      const time = `${page.date} ${afterHours ? "16:30" : "08:00"}`;
      if (time < nowEt) continue;
      const cap = parseCap(row.marketCap);
      out.push({
        event: `${row.name ?? row.symbol}（${row.symbol}）财报 · ${afterHours ? "美股盘后" : "美股盘前"}${
          row.epsForecast ? `，一致预期 EPS ${row.epsForecast}` : ""
        }`,
        time,
        importance: cap >= 100_000_000_000 ? "high" : "medium",
        impact: "neutral",
        affected_sectors: [],
        impact_reasoning: "财报尚未公布，方向取决于实际数据与一致预期的差异。",
        is_forecast: true,
        url: `https://www.nasdaq.com/market-activity/stocks/${row.symbol.toLowerCase()}/earnings`,
      });
    }
  }

  const rank: Record<Importance, number> = { high: 0, medium: 1, low: 2 };
  const high = out.filter((e) => e.importance === "high");
  const ranked = high.length ? high : out.filter((e) => e.importance === "medium");
  ranked.sort((a, b) => rank[a.importance] - rank[b.importance] || a.time.localeCompare(b.time));
  const picked = ranked.slice(0, limit).sort((a, b) => a.time.localeCompare(b.time));
  if (picked.length) {
    try {
      const schema = {
        type: "object", additionalProperties: false, required: ["items"], properties: {
          items: { type: "array", items: { type: "object", additionalProperties: false, required: ["index", "impact", "affected_sectors", "reasoning"], properties: {
            index: { type: "number" }, impact: { type: "string", enum: ["bullish", "bearish", "neutral"] },
            affected_sectors: { type: "array", items: { type: "string" } }, reasoning: { type: "string" },
          } } },
        },
      };
      const ai = await aiJson<{ items: { index: number; impact: "bullish" | "bearish" | "neutral"; affected_sectors: string[]; reasoning: string }[] }>({
        model: AI_MODEL_FAST, schemaName: "macro_calendar_impact", schema,
        system: `${GUARDRAILS}\n你只做事件影响情景推演，不把预测写成事实。若数据高于预期/低于预期方向不确定，使用 neutral。`,
        user: picked.map((e, i) => `${i}. ${e.event} | ${e.time}`).join("\n"),
      });
      for (const item of ai.items) {
        const e = picked[item.index];
        if (!e) continue;
        e.impact = item.impact; e.affected_sectors = item.affected_sectors.slice(0, 5); e.impact_reasoning = item.reasoning;
      }
    } catch {
      // AI 不可用时保留中性预测，不伪造方向。
    }
  }
  if (picked.length) await writeCache(cacheKey, picked, 900);
  return picked;
}
