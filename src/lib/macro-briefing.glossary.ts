/**
 * 专业术语的白话解释。
 * 用法：生成摘要文本时用 annotate() 在术语首次出现处加括号简注，
 * 段落末尾用 collectTerms() 输出完整术语表。
 */

export type GlossaryEntry = { term: string; meaning: string };

/** term → 一句话白话解释（尽量 20 字以内，方便内联）。 */
export const GLOSSARY_TERMS: Record<string, string> = {
  VIX: "恐慌指数，数字越高说明市场越紧张",
  CPI: "消费者物价指数，衡量老百姓买东西的通胀水平",
  PPI: "生产者物价指数，衡量工厂出厂价格的通胀水平",
  PCE: "个人消费支出物价指数，美联储最看重的通胀口径",
  非农: "美国非农业就业人数，反映就业市场冷热",
  FOMC: "美联储的利率决策会议",
  GDP: "国内生产总值，衡量经济总量增长",
  DXY: "美元指数，衡量美元整体强弱",
  "USD/CNY": "美元兑人民币汇率，数字变大代表人民币走弱",
  WTI原油: "美国原油价格基准",
  布伦特原油: "国际原油价格基准",
  黄金: "国际金价，通常在市场避险时走强",
  美10年期国债: "美国长期借钱的成本，上行会压制股票估值",
  收益率: "买入债券后每年能拿到的回报率",
  bp: "基点，1bp = 0.01%",
  板块轮动: "资金在不同行业之间的流动",
  置信度: "模型对这个判断有多确定",
  利差: "两种债券之间的利率差距，扩大通常代表风险升高",
  避险: "资金离开高风险资产、转向更安全资产",
  降息: "央行下调利率，通常有利于股票等风险资产",
  加息: "央行上调利率，通常对股票等风险资产不利",
  资本开支: "企业买设备、建产能花的钱",
  估值: "市场愿意为公司未来利润付多少钱",
};

/** 长术语优先匹配，避免「美10年期国债」被「黄金」之类的短词切开。 */
const TERMS_BY_LENGTH = Object.keys(GLOSSARY_TERMS).sort((a, b) => b.length - a.length);

export function explainTerm(term: string): string | undefined {
  return GLOSSARY_TERMS[term];
}

/**
 * 在术语首次出现的位置插入「（白话解释）」，同一段文本只注释一次。
 * 已经紧跟括号的术语不重复注释。
 */
export function annotate(text: string): string {
  if (!text) return text;
  const used = new Set<string>();
  let out = "";
  let i = 0;

  while (i < text.length) {
    let matched = "";
    for (const term of TERMS_BY_LENGTH) {
      if (used.has(term)) continue;
      if (text.startsWith(term, i)) {
        matched = term;
        break;
      }
    }

    if (matched) {
      used.add(matched);
      out += matched;
      i += matched.length;
      // 后面本来就跟着括号说明时，不再重复加注。
      if (text[i] !== "（" && text[i] !== "(") {
        out += `（${GLOSSARY_TERMS[matched]}）`;
      }
      continue;
    }

    out += text[i];
    i += 1;
  }

  return out;
}

/** 收集文本中出现过的术语，用于段末术语表（按出现顺序）。 */
export function collectTerms(text: string): GlossaryEntry[] {
  if (!text) return [];
  const found: GlossaryEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < text.length; i++) {
    for (const term of TERMS_BY_LENGTH) {
      if (seen.has(term)) continue;
      if (text.startsWith(term, i)) {
        seen.add(term);
        found.push({ term, meaning: GLOSSARY_TERMS[term]! });
        break;
      }
    }
  }
  return found;
}

/** 统一时区口径标签。 */
export const TZ_LABEL = "美国东部时间";
