import { AI_MODEL_DEEP, AI_MODEL_FAST, aiJson, guardrails, type OutputLang } from "./ai.server";
import { getFlowFacts } from "./insider-flows.server";
import { getCompanyProfile, getEarningsFacts, type CompanyProfileData } from "./fundamentals.server";
import { getUsEarningsForecast, type EarningsForecast } from "./earnings-facts.server";
import { getEarningsReactions, type EarningsReaction } from "./earnings-reaction.server";
import { getSeasonality, type Seasonality } from "./seasonality.server";
import { getEventsWindow, type WindowEvent } from "./events-window.server";
import { getChartData, yahooSymbol } from "./market-api.server";
import { resolveSymbol } from "./symbol-resolver.server";
import {
  runDebateHarness,
  verifyAgainstFacts,
  type DebateCase,
} from "./research-harness.server";

export type ResearchSectionKey = "fundamentals" | "earnings" | "cycle" | "flows";

const SOURCED = {
  type: "object",
  additionalProperties: false,
  required: ["text", "kind", "source", "as_of", "confidence"],
  properties: {
    text: { type: "string" },
    kind: { type: "string", enum: ["fact", "inference"] },
    source: { type: ["string", "null"] },
    as_of: { type: ["string", "null"] },
    confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
  },
};

export const BULL_CASE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["thesis", "claims", "caveats"],
  properties: {
    thesis: { type: "string" },
    claims: { type: "array", items: SOURCED },
    caveats: { type: "string" },
  },
};

export const BEAR_CASE_SCHEMA = BULL_CASE_SCHEMA;

const FUNDAMENTALS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["company_profile", "overview", "business_lines", "product_lines", "regions", "business_model", "moat", "customers", "suppliers", "competition", "peer_comparison", "differentiation", "weaknesses", "caveats"],
  properties: {
    company_profile: {
      type: "object",
      additionalProperties: false,
      required: ["legal_name", "exchange_ticker", "sector", "industry", "founded", "headquarters", "employees", "market_cap", "website", "summary", "kind", "source", "as_of"],
      properties: {
        legal_name: { type: ["string", "null"] },
        exchange_ticker: { type: ["string", "null"] },
        sector: { type: ["string", "null"] },
        industry: { type: ["string", "null"] },
        founded: { type: ["string", "null"] },
        headquarters: { type: ["string", "null"] },
        employees: { type: ["number", "null"] },
        market_cap: { type: ["string", "null"] },
        website: { type: ["string", "null"] },
        summary: { type: "string", description: "3-5 句业务概述" },
        kind: { type: "string", enum: ["fact", "inference"] },
        source: { type: ["string", "null"] },
        as_of: { type: ["string", "null"] },
      },
    },
    overview: { type: "string" },
    business_lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "revenue_share_pct", "note", "kind", "source", "as_of"],
        properties: {
          name: { type: "string" },
          revenue_share_pct: { type: ["number", "null"] },
          note: { type: "string" },
          kind: { type: "string", enum: ["fact", "inference"] },
          source: { type: ["string", "null"] },
          as_of: { type: ["string", "null"] },
        },
      },
    },
    product_lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "revenue_share_pct", "note", "kind", "source", "as_of"],
        properties: {
          name: { type: "string" },
          revenue_share_pct: { type: ["number", "null"] },
          note: { type: "string" },
          kind: { type: "string", enum: ["fact", "inference"] },
          source: { type: ["string", "null"] },
          as_of: { type: ["string", "null"] },
        },
      },
    },
    regions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "revenue_share_pct", "kind", "source", "as_of"],
        properties: {
          name: { type: "string" },
          revenue_share_pct: { type: ["number", "null"] },
          kind: { type: "string", enum: ["fact", "inference"] },
          source: { type: ["string", "null"] },
          as_of: { type: ["string", "null"] },
        },
      },
    },
    business_model: { type: "string" },
    moat: { type: "array", items: SOURCED },
    customers: { type: "array", items: SOURCED },
    suppliers: { type: "array", items: SOURCED },
    competition: { type: "array", items: SOURCED },
    peer_comparison: {
      type: "array",
      description: "3-5 家可比公司",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["peer", "ticker", "metrics", "note", "kind", "source", "as_of"],
        properties: {
          peer: { type: "string" },
          ticker: { type: ["string", "null"] },
          metrics: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["metric", "target_value", "peer_value", "edge"],
              properties: {
                metric: { type: "string", description: "如 毛利率 / 营收增速 / 市占率 / 估值" },
                target_value: { type: ["string", "null"] },
                peer_value: { type: ["string", "null"] },
                edge: { type: "string", enum: ["target_better", "peer_better", "similar", "unknown"] },
              },
            },
          },
          note: { type: "string" },
          kind: { type: "string", enum: ["fact", "inference"] },
          source: { type: ["string", "null"] },
          as_of: { type: ["string", "null"] },
        },
      },
    },
    differentiation: { type: "array", items: SOURCED, description: "差异化优势，无则返回空数组" },
    weaknesses: { type: "array", items: SOURCED, description: "相对同行的劣势" },
    caveats: { type: "string" },
  },
};

const EARNINGS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recent_reports", "next_report", "key_metrics", "caveats"],
  properties: {
    recent_reports: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["period", "report_date", "report_timing", "currency", "revenue_actual", "revenue_estimate", "revenue_surprise_abs", "revenue_surprise_pct", "net_income_actual", "net_income_estimate", "eps_actual", "eps_estimate", "eps_surprise_abs", "eps_surprise_pct", "summary", "beat_or_miss", "next_day_move_pct", "five_day_move_pct", "kind", "source"],
        properties: {
          period: { type: "string" },
          report_date: { type: "string" },
          report_timing: { type: "string", enum: ["before_open", "after_close", "unknown"] },
          currency: { type: ["string", "null"] },
          revenue_actual: { type: ["string", "null"], description: "带单位的具体金额，如 94.93B USD" },
          revenue_estimate: { type: ["string", "null"] },
          revenue_surprise_abs: { type: ["string", "null"], description: "实际减预期的金额差" },
          revenue_surprise_pct: { type: ["number", "null"] },
          net_income_actual: { type: ["string", "null"] },
          net_income_estimate: { type: ["string", "null"] },
          eps_actual: { type: ["string", "null"] },
          eps_estimate: { type: ["string", "null"] },
          eps_surprise_abs: { type: ["string", "null"] },
          eps_surprise_pct: { type: ["number", "null"] },
          summary: { type: "string" },
          beat_or_miss: { type: "string", enum: ["beat", "miss", "mixed", "unknown"] },
          next_day_move_pct: { type: ["number", "null"] },
          five_day_move_pct: { type: ["number", "null"] },
          kind: { type: "string", enum: ["fact", "inference"] },
          source: { type: ["string", "null"] },
        },
      },
    },
    next_report: {
      type: "object",
      additionalProperties: false,
      required: ["expected_date", "date_confidence", "consensus_eps", "consensus_revenue", "watch_items", "skew", "skew_reasoning"],
      properties: {
        expected_date: { type: "string" },
        date_confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
        consensus_eps: { type: ["string", "null"] },
        consensus_revenue: { type: ["string", "null"] },
        watch_items: { type: "array", items: { type: "string" } },
        skew: { type: "string", enum: ["bullish", "bearish", "neutral", "unknown"] },
        skew_reasoning: { type: "string" },
      },
    },
    key_metrics: { type: "array", items: SOURCED },
    caveats: { type: "string" },
  },
};

const CYCLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sector", "economic_cycle_stage", "industry_cycle_stage", "stage_reasoning", "strong_months", "weak_months", "monthly_stats", "upcoming_events", "caveats"],
  properties: {
    sector: { type: "string" },
    economic_cycle_stage: { type: "string", enum: ["early_expansion", "mid_expansion", "late_expansion", "slowdown", "recession", "recovery", "unknown"] },
    industry_cycle_stage: { type: "string" },
    stage_reasoning: { type: "string" },
    strong_months: { type: "array", items: { type: "string" } },
    weak_months: { type: "array", items: { type: "string" } },
    monthly_stats: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["month", "avg_return_pct", "win_rate_pct", "kind", "source"],
        properties: {
          month: { type: "string" },
          avg_return_pct: { type: ["number", "null"] },
          win_rate_pct: { type: ["number", "null"] },
          kind: { type: "string", enum: ["fact", "inference"] },
          source: { type: ["string", "null"] },
        },
      },
    },
    upcoming_events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "event", "direction", "logic", "confidence"],
        properties: {
          date: { type: "string" },
          event: { type: "string" },
          direction: { type: "string", enum: ["bullish", "bearish", "neutral", "unknown"] },
          logic: { type: "string" },
          confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
        },
      },
    },
    caveats: { type: "string" },
  },
};

const FLOWS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["window_days", "summary", "records", "data_gaps", "caveats"],
  properties: {
    window_days: { type: "number" },
    summary: { type: "string" },
    records: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "entity",
          "entity_type",
          "side",
          "date",
          "shares_or_amount",
          "price",
          "total_value",
          "kind",
          "source",
          "source_url",
          "filed_at",
          "note",
          "confidence",
        ],
        properties: {
          entity: { type: "string" },
          entity_type: { type: "string", enum: ["institution_13f", "insider_form4", "whale_onchain", "fund_flow", "unknown"] },
          side: { type: "string", enum: ["buy", "sell", "unknown"] },
          date: { type: "string" },
          shares_or_amount: { type: ["string", "null"] },
          price: { type: ["string", "null"] },
          total_value: { type: ["string", "null"] },
          kind: { type: "string", enum: ["fact", "inference"] },
          source: { type: ["string", "null"] },
          source_url: { type: ["string", "null"] },
          filed_at: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
          confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
        },
      },
    },
    data_gaps: { type: "array", items: { type: "string" } },
    caveats: { type: "string" },
  },
};

const SCHEMAS: Record<ResearchSectionKey, { schema: Record<string, unknown>; system: string }> = {
  fundamentals: {
    schema: FUNDAMENTALS_SCHEMA,
    system:
      "你在撰写公司基本面拆解。company_profile 必须给出公司全称、交易所与代码、板块行业、成立/上市年份、总部、员工数、市值、官网与 3-5 句业务概述；若输入中已提供真实档案数据，必须原样采用，不得改写。必须按业务线与产品线分别给出营收占比（百分比数值，保留 1 位小数），并给出地区收入拆分；每组占比应尽量接近 100%。任何占比数字都必须来自公开财报；若无法确认，revenue_share_pct 返回 null 并在 note 中说明原因。peer_comparison 选出 3-5 家真实可比公司，逐项对比毛利率/营收增速/估值/市占率等可得指标并标注 edge。differentiation 给出该标的的差异化优势，若确实没有明显差异化则返回空数组；weaknesses 给出相对劣势。",
  },
  earnings: {
    schema: EARNINGS_SCHEMA,
    system:
      "你在撰写财报分析。覆盖最近 3 次财报：期间、精确发布日期与盘前/盘后、具体营收金额、机构一致预期营收、较预期的金额差与百分比、净利润、EPS 实际与预期及差异，再加上要点、超预期/低于预期，以及财报后次日与 5 日股价波动百分比。若输入中提供了真实财报数字（实际/预期），必须原样采用并据此计算差异（(实际-预期)/|预期|×100，超预期为正）；未提供且无法确认的字段返回 null，禁止编造。若波动百分比无法确认，返回 null。下一次财报日期不确定时给出预计区间并把 date_confidence 设为 low。skew 只表示市场预期偏向，不是投资建议。",
  },
  cycle: {
    schema: CYCLE_SCHEMA,
    system:
      "你在撰写行业周期与季节性分析。必须判断所属板块在经济周期与行业周期中的位置并给出理由，指明旺季/淡季月份，并给出历史月度平均涨幅与胜率（无法确认返回 null）。upcoming_events 覆盖前后一个月的相关重大事件及影响逻辑。",
  },
  flows: {
    schema: FLOWS_SCHEMA,
    system:
      "你在撰写资金流向与聪明钱分析，数据类型包括 13F 机构持仓变动、Form 4 内部人交易、链上鲸鱼地址动向。每条记录必须尽可能给出主体、方向、日期、数量/金额、价格与来源。输入中提供的申报记录是真实数据，必须原样采用（含 source、source_url、filed_at），kind 设为 fact，不得改写数字。除此之外绝对不要编造具体持仓数字：不确定的字段返回 null，kind 设为 inference，并把缺口写进 data_gaps。港股与加密标的的公开披露有限，必须在 data_gaps 中说明。",
  },
};

export async function generateResearchSection(input: {
  symbol: string;
  market: string;
  section: ResearchSectionKey;
  lookbackDays: number;
  lang: OutputLang;
}) {
  const resolved = await resolveSymbol(input.symbol, input.market);
  const ysym = resolved.symbol || yahooSymbol(input.symbol, input.market);
  if (!resolved.verified) {
    throw new Error(`暂时无法从公开行情或监管资料确认代码 ${ysym}。请检查代码与市场，或稍后重试。`);
  }
  let priceContext = "行情数据不可用";
  try {
    const chart = await getChartData(ysym, "1Y");
    const first = chart.candles[0]?.c;
    const last = chart.candles.at(-1)?.c;
    const yearChange = first && last ? (((last - first) / first) * 100).toFixed(1) : "-";
    priceContext = `最新价 ${chart.price ?? "-"} ${chart.currency ?? ""}，近一年涨跌 ${yearChange}%（来源 Yahoo Finance，抓取时间 ${new Date().toISOString()}）`;
  } catch {
    /* keep fallback */
  }

  let grounding = "";
  let verifiedProfile: CompanyProfileData = null;
  if (input.section === "fundamentals") {
    verifiedProfile = await getCompanyProfile(ysym);
    grounding = verifiedProfile
      ? `\n已验证标的身份（${resolved.source ?? "公开市场数据"}）：${JSON.stringify(resolved)}\n真实公司档案（来源 ${verifiedProfile.source}，${verifiedProfile.as_of}，必须原样采用）：${JSON.stringify(verifiedProfile)}`
      : "\n未取得第三方公司档案数据：company_profile 各字段只能填你能确认的内容，其余返回 null，kind 设为 inference。";
  }
  /** 代码算出的硬数据，直接随 payload 返回，UI 优先展示，不经 AI 改写。 */
  const computed: {
    forecast?: EarningsForecast | null;
    reactions?: EarningsReaction[];
    seasonality?: Seasonality | null;
    events?: WindowEvent[];
  } = {};

  if (input.section === "earnings") {
    const [facts, forecast] = await Promise.all([
      getEarningsFacts(ysym, 3),
      getUsEarningsForecast(input.symbol).catch(() => null),
    ]);
    const reactions = await getEarningsReactions(
      ysym,
      facts.map((f) => ({ report_date: f.report_date, timing: f.timing })),
    );
    computed.forecast = forecast;
    computed.reactions = reactions;

    grounding = facts.length
      ? `\n真实财报数字（EPS 实际与一致预期来自 Nasdaq，营收与净利润来自 SEC XBRL 申报；必须原样采用并据此计算差异；null 表示该字段无公开数据）：${JSON.stringify(facts)}`
      : "\n未取得第三方财报数字（该市场公开一致预期有限）：无法确认的营收/净利润/EPS 与预期字段必须返回 null，并在 caveats 说明「无一致预期数据」。";
    if (reactions.length) {
      grounding += `\n财报后真实价格反应（由 Yahoo 日线计算，base_date 为基准收盘日；必须原样采用到 next_day_move_pct / five_day_move_pct，禁止改数）：${JSON.stringify(reactions)}`;
    } else {
      grounding += "\n无法计算财报后价格反应：next_day_move_pct 与 five_day_move_pct 必须返回 null。";
    }
    grounding += forecast
      ? `\n下一次财报前瞻一致预期（来源 ${forecast.source}，必须原样采用；expected_date 为 null 时把 date_confidence 设为 low）：${JSON.stringify(forecast)}`
      : "\n未取得前瞻一致预期：consensus_eps / consensus_revenue 必须返回 null，date_confidence 设为 low。";
  }

  if (input.section === "cycle") {
    const [seasonality, events] = await Promise.all([
      getSeasonality(ysym).catch(() => null),
      getEventsWindow({ symbol: input.symbol, ysym, lang: input.lang === "en" ? "en" : "zh" }).catch(
        () => [],
      ),
    ]);
    computed.seasonality = seasonality;
    computed.events = events;

    grounding = seasonality
      ? `\n真实月度季节性统计（Yahoo 月线，完整年度 ${seasonality.complete_years} 年；monthly_stats 必须原样采用其 avg_return_pct 与 win_rate_pct，禁止改数）：${JSON.stringify(seasonality)}`
      : "\n未取得月线数据：monthly_stats 必须返回空数组。";
    grounding += events.length
      ? `\n真实前后一个月事件（含发布时间与原文链接，upcoming_events 只能从中挑选，date 用其 at 字段）：${JSON.stringify(events.slice(0, 20))}`
      : "\n未取得可核实的事件：upcoming_events 必须返回空数组。";
  }

  if (input.section === "flows") {
    const flows = await getFlowFacts({ symbol: input.symbol, ysym, market: input.market });
    grounding =
      (flows.records.length
        ? `\n真实资金流申报记录（来源 SEC EDGAR Form 4 / 13F 汇总 / 公链浏览器，必须原样采用，kind 设为 fact，并把 source 与 source_url、filed_at 原样带出）：${JSON.stringify(
            flows.records,
          )}`
        : "\n未取得任何可核实的申报或链上记录：records 必须返回空数组，禁止编造任何主体、数量或金额。") +
      (flows.gaps.length ? `\n必须写入 data_gaps 的已知缺口：${JSON.stringify(flows.gaps)}` : "");
  }

  const cfg = SCHEMAS[input.section];
  const commonUser = `研究标的：${input.symbol}（市场 ${input.market}，Yahoo 代码 ${ysym}）。资金流向时间窗：过去 ${input.lookbackDays} 天。\n实时行情参考：${priceContext}${grounding}`;
  const singleCall = () =>
    aiJson<Record<string, unknown>>({
      model: AI_MODEL_DEEP,
      schemaName: `research_${input.section}`,
      schema: cfg.schema,
      system: `${guardrails(input.lang)}\n${cfg.system}`,
      user: `${commonUser}\n请输出该标的对应模块的分析。`,
    });

  let ai: Record<string, unknown>;
  let debateTrace: unknown = undefined;
  if (input.section === "fundamentals") {
    const debateBase = `${guardrails(input.lang)}\n${cfg.system}\n你是多智能体研究 Harness 的一名独立分析员。只使用下方 grounding facts，不得补充外部知识。`;
    const runPerspective = (role: "bull" | "bear") =>
      aiJson<DebateCase>({
        model: AI_MODEL_FAST,
        schemaName: `${role}_fundamentals_case`,
        schema: role === "bull" ? BULL_CASE_SCHEMA : BEAR_CASE_SCHEMA,
        system: `${debateBase}\n${role === "bull" ? "尽可能挖掘乐观论据、潜在机会和可能的正向触发条件。" : "尽可能挖掘风险、脆弱点和可能的负向触发条件。"}`,
        user: `${commonUser}\n请输出 ${role === "bull" ? "Bull" : "Bear"} case；每条 claim 必须标注事实/推演与来源。`,
      });
    const result = await runDebateHarness({
      bull: runPerspective.bind(null, "bull"),
      bear: runPerspective.bind(null, "bear"),
      synthesize: (bull, bear) =>
        aiJson<Record<string, unknown>>({
          model: AI_MODEL_DEEP,
          schemaName: "research_fundamentals_synthesized",
          schema: FUNDAMENTALS_SCHEMA,
          system: `${guardrails(input.lang)}\n${cfg.system}\n你是 Synthesizer。综合 Bull 与 Bear 两份分析，只能保留 grounding facts 能支持的事实；冲突时降低 confidence，禁止编造。`,
          user: `${commonUser}\n\nBull case:\n${JSON.stringify(bull)}\n\nBear case:\n${JSON.stringify(bear)}\n请输出完整 fundamentals 结构。`,
        }),
      fallback: singleCall,
      verify: (output) => verifyAgainstFacts(output, { resolved, verifiedProfile, computed, grounding }),
      synthesizerModel: AI_MODEL_DEEP,
    });
    ai = result.output;
    debateTrace = result.trace;
  } else {
    ai = await singleCall();
  }

  if (input.section === "fundamentals" && verifiedProfile) {
    const generated = ai["company_profile"];
    const generatedProfile = generated && typeof generated === "object" && !Array.isArray(generated)
      ? generated as Record<string, unknown>
      : {};
    ai["company_profile"] = {
      ...generatedProfile,
      legal_name: verifiedProfile.name ?? resolved.name,
      exchange_ticker: `${verifiedProfile.exchange ?? resolved.exchange ?? input.market} / ${ysym}`,
      sector: verifiedProfile.sector,
      industry: verifiedProfile.industry,
      founded: verifiedProfile.founded,
      headquarters: verifiedProfile.headquarters,
      employees: verifiedProfile.employees,
      market_cap: verifiedProfile.marketCap == null ? null : String(verifiedProfile.marketCap),
      website: verifiedProfile.website,
      kind: "fact",
      source: verifiedProfile.source,
      as_of: verifiedProfile.as_of,
    };
  }

  return { ...ai, _facts: computed, ...(debateTrace ? { _debate: debateTrace } : {}) };
}
