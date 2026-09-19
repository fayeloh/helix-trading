/** 专业术语的白话解释：术语保留原名，界面上在其后以小字/括号说明。 */
export const GLOSSARY: Record<string, string> = {
  VIX: "恐慌指数，数字越高说明市场越紧张",
  DXY: "美元指数，衡量美元整体强弱",
  "USD/CNY": "美元兑人民币汇率，数字变大代表人民币走弱",
  WTI原油: "美国原油价格基准",
  黄金: "国际金价，通常在市场避险时走强",
  美10年期国债: "长期借钱的成本，上行会压制股票估值",
  bp: "基点，1bp = 0.01%",
  板块轮动: "资金在不同行业之间的流动",
  置信度: "模型对这个判断有多确定",
};

export function explain(term: string): string | undefined {
  return GLOSSARY[term];
}

/** 统一时区口径：所有时间均按美国东部时间展示。 */
export const TZ_LABEL = "美国东部时间";
