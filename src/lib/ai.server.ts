const GATEWAY = "https://api.openai.com/v1/chat/completions";

export const AI_MODEL_FAST = "gpt-4o-mini";
export const AI_MODEL_DEEP = "gpt-4o";

export class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function friendly(status: number, message: string): string {
  if (status === 402) return "AI 额度已用尽，请检查账户余额后重试。";
  if (status === 403) return "AI 功能已被工作区策略禁用或达到额度上限。";
  if (status === 429) return "AI 请求过于频繁，请稍后重试。";
  if (status >= 500) return "AI 服务暂时不可用，请稍后重试。";
  return message || "AI 请求失败。";
}

/**
 * Structured JSON call against the OpenAI-compatible gateway.
 * Server-only: reads OPENAI_API_KEY at call time.
 */
export async function aiJson<T>(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  schemaName: string;
  model?: string;
}): Promise<T> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new AiError(401, "AI 未配置（缺少 OPENAI_API_KEY）。");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model ?? AI_MODEL_FAST,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
      },
    }),
  });

  if (!res.ok) {
    let message = "";
    try {
      const body = (await res.json()) as { error?: { message?: string }; message?: string };
      message = body?.error?.message ?? body?.message ?? "";
    } catch {
      message = await res.text().catch(() => "");
    }
    throw new AiError(res.status, friendly(res.status, message));
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new AiError(502, "AI 未返回内容，请重试。");
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new AiError(502, "AI 返回内容无法解析，请重试。");
  }
}

/** 全局幻觉控制前缀：所有 prompt 共用。 */
export type OutputLang = "zh" | "en";

/** 语言指令：所有 prompt 通过 guardrails(lang) 拼接。 */
export function langRule(lang: OutputLang): string {
  return lang === "en"
    ? "1. Write ALL output in English (US). Keep tickers and financial terms in English."
    : "1. 全部输出使用简体中文；公司名、代码、财务术语可保留英文。";
}

function base(langLine: string): string {
  return `你是一名严谨的买方研究分析师，服务于一个交易决策辅助工具。硬性规则：
${langLine}
2. 严格区分「事实」与「推演」：kind 字段必须为 "fact"（有公开数据支撑，需给出 source 与 as_of）或 "inference"（你的推理，需给出 confidence）。
3. 不确定或没有可靠数据时，必须写 "unknown" 或将该项留空，绝对禁止编造具体数字、日期、金额或引用不存在的报道。
4. 不得输出任何买卖建议、目标价、评级或荐股结论。只输出「观察要点」「触发条件」「风险点」。
5. 数字类字段若无可靠依据，返回 null。
6. 你的训练数据存在截止时间，涉及近期数据时必须在 caveats 中说明数据可能过时。`;
}

export const GUARDRAILS = base(langRule("zh"));

export function guardrails(lang: OutputLang): string {
  return base(langRule(lang));
}

export const FACT_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["text", "kind", "source", "as_of", "confidence"],
  properties: {
    text: { type: "string" },
    kind: { type: "string", enum: ["fact", "inference"] },
    source: { type: ["string", "null"], description: "数据来源名称或链接，未知填 null" },
    as_of: { type: ["string", "null"], description: "数据时间，未知填 null" },
    confidence: { type: ["string", "null"], enum: ["high", "medium", "low", null] },
  },
} as const;
