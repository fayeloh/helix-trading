import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from "react";

export type Lang = "zh" | "en";

const STORAGE_KEY = "helix_lang";

type Dict = Record<string, string>;

const zh: Dict = {
  "app.tagline": "决策辅助",
  "nav.overview": "总览",
  "nav.briefing": "每日简报",
  "nav.markets": "指数看板",
  "nav.research": "标的研究",
  "nav.accounts": "账户持仓",
  "nav.journal": "交易纪律",
  "nav.impacts": "影响复盘",
  "shell.verifying": "正在校验身份…",
  "shell.signOut": "退出登录",
  "shell.newAccount": "新建账户",
  "lang.label": "语言",

  "research.title": "标的深度研究",
  "research.subtitle": "美股 / 港股 / A股 / 加密货币。所有结论区分「事实」与「推演」，并标注来源与数据时间。",
  "research.symbol": "标的代码",
  "research.market": "市场",
  "research.window": "资金流窗口",
  "research.days": "天",
  "research.run": "研究",
  "research.generate": "生成本模块",
  "research.generating": "生成中…",
  "research.recompute": "重算",
  "research.empty": "点击「生成本模块」获取分析（结果缓存 24 小时）。",
  "research.meta": "生成时间 {time} · 模型 {model} · 缓存 24 小时",

  "section.fundamentals": "公司基本面",
  "section.earnings": "财报分析",
  "section.cycle": "周期与季节性",
  "section.flows": "资金流向与聪明钱",

  "f.profile": "公司简介",
  "f.fullName": "公司全称",
  "f.exchange": "交易所 / 代码",
  "f.sector": "板块 / 行业",
  "f.founded": "成立年份",
  "f.hq": "总部",
  "f.employees": "员工数",
  "f.marketCap": "市值",
  "f.website": "官网",
  "f.overview": "业务概览",
  "f.byBusiness": "按业务线营收占比",
  "f.byProduct": "按产品线营收占比",
  "f.byRegion": "按地区营收占比",
  "f.total": "合计",
  "f.model": "商业模式",
  "f.moat": "护城河",
  "f.customers": "主要客户",
  "f.suppliers": "主要供应商",
  "f.competition": "竞争格局",
  "f.peers": "同业竞争力对比",
  "f.peerMetric": "指标",
  "f.advantages": "差异化优势",
  "f.disadvantages": "相对劣势",
  "f.noDiff": "未发现明显差异化。",

  "e.recent": "近三次财报",
  "e.reportDate": "发布日期",
  "e.timing": "时段",
  "e.revenue": "营收",
  "e.revenueEst": "营收预期",
  "e.revenueDiff": "营收较预期",
  "e.netIncome": "净利润",
  "e.eps": "EPS",
  "e.epsEst": "EPS 预期",
  "e.epsDiff": "EPS 较预期",
  "e.actual": "实际",
  "e.estimate": "预期",
  "e.surprise": "较预期",
  "e.nextDay": "次日",
  "e.fiveDay": "5 日",
  "e.next": "下一次财报与预期",
  "e.consensusEps": "一致预期 EPS",
  "e.consensusRev": "一致预期营收",
  "e.watch": "关键观察指标",
  "e.skew": "偏向",
  "e.beforeOpen": "盘前",
  "e.afterClose": "盘后",
  "e.unknownTiming": "时段未知",

  "common.source": "来源",
  "common.asOf": "数据时间",
  "common.unlabeled": "未标注",
  "common.noData": "未披露",
  "common.noConsensus": "无一致预期",
  "common.fact": "事实",
  "common.inference": "推演",
  "common.caveats": "数据限制与说明",
};

const en: Dict = {
  "app.tagline": "Decision support",
  "nav.overview": "Overview",
  "nav.briefing": "Daily briefing",
  "nav.markets": "Index board",
  "nav.research": "Research",
  "nav.accounts": "Accounts",
  "nav.journal": "Discipline",
  "nav.impacts": "Impact review",
  "shell.verifying": "Verifying session…",
  "shell.signOut": "Sign out",
  "shell.newAccount": "New account",
  "lang.label": "Language",

  "research.title": "Deep-dive research",
  "research.subtitle":
    "US / HK / A-shares / crypto. Every claim is marked as fact or inference, with source and as-of date.",
  "research.symbol": "Symbol",
  "research.market": "Market",
  "research.window": "Flow window",
  "research.days": "days",
  "research.run": "Research",
  "research.generate": "Generate section",
  "research.generating": "Generating…",
  "research.recompute": "Recompute",
  "research.empty": "Click “Generate section” to run the analysis (results cached 24h).",
  "research.meta": "Generated {time} · model {model} · cached 24h",

  "section.fundamentals": "Fundamentals",
  "section.earnings": "Earnings",
  "section.cycle": "Cycle & seasonality",
  "section.flows": "Flows & smart money",

  "f.profile": "Company profile",
  "f.fullName": "Legal name",
  "f.exchange": "Exchange / ticker",
  "f.sector": "Sector / industry",
  "f.founded": "Founded",
  "f.hq": "Headquarters",
  "f.employees": "Employees",
  "f.marketCap": "Market cap",
  "f.website": "Website",
  "f.overview": "Business overview",
  "f.byBusiness": "Revenue mix by business line",
  "f.byProduct": "Revenue mix by product line",
  "f.byRegion": "Revenue mix by region",
  "f.total": "Total",
  "f.model": "Business model",
  "f.moat": "Moat",
  "f.customers": "Key customers",
  "f.suppliers": "Key suppliers",
  "f.competition": "Competitive landscape",
  "f.peers": "Peer comparison",
  "f.peerMetric": "Metric",
  "f.advantages": "Differentiators",
  "f.disadvantages": "Relative weaknesses",
  "f.noDiff": "No clear differentiation identified.",

  "e.recent": "Last three reports",
  "e.reportDate": "Report date",
  "e.timing": "Timing",
  "e.revenue": "Revenue",
  "e.revenueEst": "Revenue estimate",
  "e.revenueDiff": "Revenue surprise",
  "e.netIncome": "Net income",
  "e.eps": "EPS",
  "e.epsEst": "EPS estimate",
  "e.epsDiff": "EPS surprise",
  "e.actual": "Actual",
  "e.estimate": "Estimate",
  "e.surprise": "Surprise",
  "e.nextDay": "Next day",
  "e.fiveDay": "5-day",
  "e.next": "Next report & expectations",
  "e.consensusEps": "Consensus EPS",
  "e.consensusRev": "Consensus revenue",
  "e.watch": "Key items to watch",
  "e.skew": "Skew",
  "e.beforeOpen": "Before open",
  "e.afterClose": "After close",
  "e.unknownTiming": "Timing unknown",

  "common.source": "Source",
  "common.asOf": "As of",
  "common.unlabeled": "not stated",
  "common.noData": "Not disclosed",
  "common.noConsensus": "No consensus available",
  "common.fact": "Fact",
  "common.inference": "Inference",
  "common.caveats": "Data limitations",
};

const DICTS: Record<Lang, Dict> = { zh, en };

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
};

// Keep one context identity across route splitting and Vite hot updates. Without
// this, an updated route can briefly consume a new context object while the
// mounted root provider still owns the previous one, resulting in a blank page.
const CONTEXT_KEY = Symbol.for("helix-trading.lang-context");
const contextRegistry = globalThis as typeof globalThis & {
  [CONTEXT_KEY]?: Context<LangCtx | null>;
};
const Ctx = contextRegistry[CONTEXT_KEY] ?? createContext<LangCtx | null>(null);
contextRegistry[CONTEXT_KEY] = Ctx;

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "zh" || stored === "en") setLangState(stored);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
  }, []);

  const value = useMemo<LangCtx>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang,
      locale: lang === "zh" ? "zh-CN" : "en-US",
      t: (key, vars) => {
        let out = dict[key] ?? DICTS.zh[key] ?? key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
        }
        return out;
      },
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLang must be used inside LangProvider");
  return ctx;
}
