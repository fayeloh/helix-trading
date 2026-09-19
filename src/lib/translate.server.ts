import { aiJson, AI_MODEL_FAST } from "./ai.server";
import { stableHash } from "./hash.server";
import { readCache, writeCache } from "./market.server";

const CACHE_TTL = 30 * 24 * 3600; // 译文长期复用，节省 AI 额度

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["i", "zh"],
        properties: {
          i: { type: "integer" },
          zh: { type: "string" },
        },
      },
    },
  },
} as const;

function hasChinese(s: string): boolean {
  return /[\u4e00-\u9fa5]/.test(s);
}

function cacheKey(title: string): string {
  return `tr_zh_${stableHash(title)}`;
}

/**
 * 英文标题 → 简体中文（逐条缓存 + 批量调用）。
 * 翻译失败或额度不足时原样返回英文，绝不丢标题。
 */
export async function translateTitlesToZh(titles: string[]): Promise<string[]> {
  const out = [...titles];
  const pending: { idx: number; title: string }[] = [];

  await Promise.all(
    titles.map(async (t, idx) => {
      if (!t || hasChinese(t)) return;
      const cached = await readCache<string>(cacheKey(t)).catch(() => null);
      if (cached) {
        out[idx] = cached;
        return;
      }
      pending.push({ idx, title: t });
    }),
  );

  if (!pending.length) return out;

  try {
    const res = await aiJson<{ items: { i: number; zh: string }[] }>({
      model: AI_MODEL_FAST,
      schemaName: "headline_translations",
      schema: SCHEMA as unknown as Record<string, unknown>,
      system:
        "你是财经新闻标题翻译员。把每条英文标题翻译成简洁准确的简体中文（不超过 40 字）。" +
        "公司名用通用中文译名，股票代码、指数名、数字与百分比保持原样。不要增加任何解释或评论。",
      user: JSON.stringify(pending.map((p, i) => ({ i, title: p.title }))),
    });
    for (const item of res.items ?? []) {
      const target = pending[item.i];
      if (!target || !item.zh?.trim()) continue;
      const zh = item.zh.trim();
      out[target.idx] = zh;
      void writeCache(cacheKey(target.title), zh, CACHE_TTL).catch(() => {});
    }
  } catch {
    // 保留英文原标题
  }

  return out;
}
