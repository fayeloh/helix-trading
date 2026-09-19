import { AI_MODEL_FAST, aiJson, guardrails, type OutputLang } from "./ai.server";
import { getIndexBoardData } from "./market-api.server";
import { fetchHoldingsNews, fetchMacroNews, renderNews } from "./news.server";

export type HoldingRow = {
  symbol: string;
  display_name: string | null;
  market: string;
  currency: string;
  quantity: number;
  avg_cost: number;
  sector: string | null;
  industry_tags: string[];
};

const IMPACT = {
  type: "object",
  additionalProperties: false,
  required: ["target", "direction", "reasoning", "kind", "confidence"],
  properties: {
    target: { type: "string", description: "受影响的板块或标的" },
    direction: { type: "string", enum: ["bullish", "bearish", "neutral", "unknown"] },
    reasoning: { type: "string" },
    kind: { type: "string", enum: ["fact", "inference"] },
    confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
  },
};

const SECTORS = {
  type: "array",
  items: { type: "string" },
  description: "受影响板块/主题标签，2-4 个短标签（如「半导体」「美债利率」）",
};

const ACTION_NOTE = {
  type: "string",
  description: "一句注意要点：需要观察什么、以及什么信号出现要重新评估。严禁买卖指令与目标价。",
};

const HEADLINE = {
  type: "object",
  additionalProperties: false,
  required: ["title", "published_at", "source", "takeaway", "importance", "sectors", "action_note", "impacts"],
  properties: {
    title: { type: "string" },
    published_at: {
      type: "string",
      description: "发布时间，格式 YYYY-MM-DD HH:mm（展示时区）/ HH:mm ET；素材中没有时间就写 unknown",
    },
    source: { type: ["string", "null"], description: "素材中给出的来源名称，未知填 null" },
    takeaway: { type: "string", description: "一句话要点" },
    importance: { type: "string", enum: ["high", "medium", "low"] },
    sectors: SECTORS,
    action_note: ACTION_NOTE,
    impacts: { type: "array", items: IMPACT },
  },
};

const ECON_EVENT = {
  type: "object",
  additionalProperties: false,
  required: [
    "event",
    "release_time",
    "region",
    "consensus",
    "previous",
    "importance",
    "sectors",
    "action_note",
    "impacts",
  ],
  properties: {
    event: { type: "string" },
    release_time: {
      type: "string",
      description: "公布时间，格式 YYYY-MM-DD HH:mm（展示时区）/ HH:mm ET；不确定写 unknown",
    },
    region: { type: "string" },
    consensus: { type: ["string", "null"], description: "市场预期值，未检索到填 null" },
    previous: { type: ["string", "null"], description: "前值，未检索到填 null" },
    importance: { type: "string", enum: ["high", "medium", "low"] },
    sectors: SECTORS,
    action_note: ACTION_NOTE,
    impacts: { type: "array", items: IMPACT },
  },
};

const EARNINGS_ITEM = {
  type: "object",
  additionalProperties: false,
  required: ["company", "symbol", "date", "timing", "in_portfolio", "sectors", "note"],
  properties: {
    company: { type: "string" },
    symbol: { type: ["string", "null"] },
    date: { type: "string", description: "YYYY-MM-DD，不确定写 unknown" },
    timing: { type: "string", enum: ["before_open", "after_close", "during_session", "unknown"] },
    in_portfolio: { type: "boolean", description: "是否属于用户当前持仓；宏观简报一律 false" },
    sectors: SECTORS,
    note: ACTION_NOTE,
  },
};


const WATCH_OUT = {
  type: "object",
  additionalProperties: false,
  required: ["label", "detail", "trigger"],
  properties: {
    label: { type: "string" },
    detail: { type: "string" },
    trigger: { type: "string", description: "什么信号出现时需要重新评估" },
  },
};

const MACRO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "as_of", "headlines", "econ_events", "earnings_today", "watch_outs", "caveats"],
  properties: {
    summary: { type: "string", description: "3-5 句当下市场状态概览" },
    as_of: { type: "string", description: "本简报素材截至时间，直接复述用户给出的抓取时间" },
    headlines: { type: "array", items: HEADLINE },
    econ_events: { type: "array", items: ECON_EVENT },
    earnings_today: { type: "array", items: EARNINGS_ITEM },
    watch_outs: { type: "array", items: WATCH_OUT },
    caveats: { type: "string" },
  },
};

const PORTFOLIO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "as_of",
    "headlines",
    "econ_events",
    "earnings_today",
    "watch_outs",
    "tailwinds",
    "headwinds",
    "watch_points",
    "calendar",
    "risk_flags",
    "caveats",
  ],
  properties: {
    summary: { type: "string" },
    as_of: { type: "string" },
    headlines: { type: "array", items: HEADLINE },
    econ_events: { type: "array", items: ECON_EVENT },
    earnings_today: { type: "array", items: EARNINGS_ITEM },
    watch_outs: { type: "array", items: WATCH_OUT },
    tailwinds: { type: "array", items: IMPACT },
    headwinds: { type: "array", items: IMPACT },
    watch_points: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["symbol", "observation", "trigger", "kind", "confidence"],
        properties: {
          symbol: { type: "string" },
          observation: { type: "string", description: "观察要点，禁止买卖建议" },
          trigger: { type: "string" },
          kind: { type: "string", enum: ["fact", "inference"] },
          confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
        },
      },
    },
    calendar: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "event", "affected", "potential_impact", "kind", "confidence"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD，未知写 unknown" },
          event: { type: "string" },
          affected: { type: "string" },
          potential_impact: { type: "string" },
          kind: { type: "string", enum: ["fact", "inference"] },
          confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
        },
      },
    },
    risk_flags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "detail"],
        properties: { label: { type: "string" }, detail: { type: "string" } },
      },
    },
    caveats: { type: "string" },
  },
};

function marketContext(board: Awaited<ReturnType<typeof getIndexBoardData>>) {
  return board.rows
    .filter((r) => r.days.length)
    .map((r) => {
      const d = r.days.at(-1)!;
      return `${r.label}: ${d.date} ${d.changePct?.toFixed(2) ?? "-"}%（收 ${d.close}）`;
    })
    .join("；");
}

const NEWS_RULES = `素材使用规则（强制）：
- headlines / econ_events / earnings_today 只能来自我提供的检索素材，禁止引入素材中不存在的新闻或公司。
- published_at / release_time 必须来自素材中给出的时间戳，换算为展示时区并附 ET；素材没给时间就写 unknown，禁止推测。
- source 必须使用素材中的来源名称。
- 影响推演（impacts）可以是你的推理，但 kind 必须标为 inference 并给出 confidence；素材中直接写明的事实才可标 fact。
- 每条 headline / econ_event / earnings 都必须填写 sectors（受影响板块标签）与 action_note（注意要点 + 重估触发条件，禁止操作指令）。
- headlines 输出 4-8 条，按重要性与时间新鲜度排序；econ_events 输出当日/次日 3-8 条；earnings_today 输出当日发布的公司 0-8 条；watch_outs 输出 3-5 条。`;

function nowLine(timezone: string, fetchedAt: string) {
  const local = new Date().toLocaleString("sv-SE", { timeZone: timezone });
  const et = new Date().toLocaleString("sv-SE", { timeZone: "America/New_York" });
  return `当前时间：${local}（${timezone}） / ${et}（America/New_York）。新闻素材抓取时间：${new Date(
    fetchedAt,
  ).toLocaleString("sv-SE", { timeZone: timezone })}。`;
}

export async function generateMacroBriefing(timezone: string, lang: OutputLang = "zh") {
  const [board, news] = await Promise.all([getIndexBoardData(), fetchMacroNews(lang)]);

  return await aiJson<Record<string, unknown>>({
    model: AI_MODEL_FAST,
    schemaName: "macro_briefing",
    schema: MACRO_SCHEMA,
    system: `${guardrails(lang)}\n你在撰写「当下」全球财经实时简报（不是回顾性日报）。结构：今日头条 → 当日经济数据/央行事件 → 当日财报日历 → 注意事项。\n${NEWS_RULES}\n- 覆盖美股、港股/中国、加密货币三个维度。\n- as_of 字段直接复述我给出的素材抓取时间。`,
    user: `${nowLine(timezone, news.fetchedAt)}\n\n【实时指数行情（Yahoo Finance，${board.fetchedAt}）】\n${marketContext(board)}\n\n【检索到的当日财经头条】\n${renderNews(news.headlines, timezone)}\n\n【检索到的经济数据 / 央行 / 政策类条目】\n${renderNews(news.econ, timezone)}\n\n【检索到的财报相关条目】\n${renderNews(news.earnings, timezone)}`,
  });
}

export async function generatePortfolioBriefing(
  holdings: HoldingRow[],
  timezone: string,
  baseCurrency: string,
  lang: OutputLang = "zh",
) {
  const [board, news] = await Promise.all([
    getIndexBoardData(),
    fetchHoldingsNews(holdings.map((h) => h.symbol), lang),
  ]);
  const list = holdings
    .map(
      (h) =>
        `${h.symbol}（${h.display_name ?? "?"}，市场 ${h.market}，币种 ${h.currency}，数量 ${h.quantity}，成本 ${h.avg_cost}，板块 ${h.sector ?? "未标注"}${h.industry_tags.length ? `，标签 ${h.industry_tags.join("/")}` : ""}）`,
    )
    .join("\n");

  return await aiJson<Record<string, unknown>>({
    model: AI_MODEL_FAST,
    schemaName: "portfolio_briefing",
    schema: PORTFOLIO_SCHEMA,
    system: `${guardrails(lang)}\n你在撰写「持仓定制化实时简报」。结构：今日头条（只保留与持仓或其板块相关的）→ 当日经济数据事件 → 当日财报日历（in_portfolio 标注是否为用户持仓）→ 注意事项 → 持仓利多/利空 → 观察要点 → 未来交易日日历 → 组合风险。\n${NEWS_RULES}\n- tailwinds / headwinds 的 target 必须是用户实际持有的标的代码或其所属板块，不得引入用户未持有的标的。\n- watch_points 只能是观察要点与失效触发条件，严禁"买入/卖出/加仓/减仓/目标价"等表述。\n- 展示时区 ${timezone}，基准货币 ${baseCurrency}。`,
    user: `${nowLine(timezone, news.fetchedAt)}\n\n【当前账户持仓】\n${list}\n\n【实时指数行情（Yahoo Finance，${board.fetchedAt}）】\n${marketContext(board)}\n\n【与持仓标的直接关联的新闻（Yahoo Finance）】\n${renderNews(news.holdings, timezone)}\n\n【当日财经头条】\n${renderNews(news.headlines, timezone)}\n\n【经济数据 / 央行 / 政策】\n${renderNews(news.econ, timezone)}\n\n【财报相关】\n${renderNews(news.earnings, timezone)}`,
  });
}
