import type { TopHeadline } from "./macro-briefing.types";

const SPACE_NEWS_PATTERN =
  /(太空|航天|火箭|卫星|商业发射|space\b|aerospace\b|rocket\b|satellite\b|orbital\b|spaceflight\b|SpaceX|AST SpaceMobile|Rocket Lab|Intuitive Machines|Redwire|Planet Labs|Virgin Galactic)/i;

/**
 * 将利多太空产业的新闻影响扩展到整个板块。
 * 该层同时作用于新抓取数据与旧缓存，避免只展示单一公司影响。
 */
export function expandBullishSpaceImpact(headline: TopHeadline): TopHeadline {
  const text = [
    headline.headline,
    headline.headline_original ?? "",
    ...headline.affected_sectors,
  ].join(" ");
  if (headline.impact !== "bullish" || !SPACE_NEWS_PATTERN.test(text))
    return headline;

  return {
    ...headline,
    affected_sectors: [
      "太空板块",
      ...headline.affected_sectors.filter((sector) => sector !== "太空板块"),
    ],
    reasoning:
      "相关进展改善太空产业链的需求、订单或融资预期，短期利多整个太空板块，而非仅限于单一公司。",
  };
}
