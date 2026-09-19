import type { TrendSignal } from "@/lib/macro-briefing.types";

import { ImpactTag, type Impact } from "./ImpactTag";

const BULLISH_WORDS = ["回升", "上行", "走强", "改善", "扩张", "上修", "转强", "升温"];
const BEARISH_WORDS = ["转弱", "走弱", "下行", "回落", "收缩", "恶化", "下修", "降温"];
/** 反向主题：这些主题走强对股票偏不利，走弱偏有利。 */
const INVERSE_THEMES = ["美元", "波动", "恐慌", "利率", "收益率", "通胀"];

/** 由信号文本推导对股票的影响方向。 */
export function signalImpact(theme: string, signal: string): Impact {
  const isBull = BULLISH_WORDS.some((w) => signal.includes(w));
  const isBear = BEARISH_WORDS.some((w) => signal.includes(w));
  if (!isBull && !isBear) return "neutral";
  const inverse = INVERSE_THEMES.some((t) => theme.includes(t));
  const bullish = inverse ? isBear : isBull;
  return bullish ? "bullish" : "bearish";
}

export function TrendSignals({ data }: { data: TrendSignal[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">数据暂不可用</p>;

  return (
    <div className="space-y-3">
      {data.map((s) => {
        const pct = Math.round(Math.max(0, Math.min(1, s.confidence)) * 100);
        const impact = signalImpact(s.theme, s.signal);
        return (
          <div key={s.theme} className="rounded-lg border border-border/60 bg-surface/50 p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium text-foreground">{s.theme}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                  {s.signal}
                </span>
                <ImpactTag impact={impact} {...(pct < 50 ? { suffix: "置信度偏低" } : {})} />
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${s.theme} 置信度`}
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">置信度 {pct}%</span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">触发：{s.trigger}</p>
          </div>
        );
      })}
      <p className="text-xs leading-relaxed text-muted-foreground">
        利多｜利空是指该趋势对股票这类风险资产的影响方向；美元、利率、波动率走强通常按「利空」计。置信度＝模型对这个判断有多确定；触发＝让模型得出判断的具体现象。以上为模型识别的市场趋势，非个股或个人操作建议。
      </p>
    </div>
  );
}
