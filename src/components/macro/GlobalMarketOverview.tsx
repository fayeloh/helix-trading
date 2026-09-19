import type { GlobalMarketOverview as Overview } from "@/lib/macro-briefing.types";

import { explain } from "./glossary";
import { fmtBp, fmtPct, fmtValue, quoteClass, riskClass } from "./quote-color";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface/40">
      <p className="micro-label border-b border-border px-3 py-2">{title}</p>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  change,
  changeValue,
  inverse = false,
}: {
  label: string;
  value?: string;
  change: string;
  changeValue: number;
  inverse?: boolean;
}) {
  const note = explain(label);
  return (
    <div className="px-3 py-2 odd:bg-foreground/[0.02]">
      <div className="flex min-h-[20px] items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] text-foreground">{label}</span>
        <span className="flex shrink-0 items-baseline gap-2">
          {value ? <span className="tabular text-[13px] text-muted-foreground">{value}</span> : null}
          <span
            className={`tabular w-[74px] text-right text-[13px] font-semibold ${inverse ? riskClass(changeValue) : quoteClass(changeValue)}`}
          >
            {change}
          </span>
        </span>
      </div>
      {note ? <p className="mt-0.5 text-xs text-faint">{note}</p> : null}
    </div>
  );
}

export function GlobalMarketOverview({ data }: { data: Overview }) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-surface/40 px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px]">
            VIX 波动率
            <span className="ml-2 text-xs text-faint">
              {data.vix_change_pct <= 0 ? "风险偏好偏暖" : "波动率定价上移"}
            </span>
          </span>
          <span className="flex shrink-0 items-baseline gap-2">
            <span className="tabular text-xl font-semibold">{data.vix.toFixed(2)}</span>
            <span className={`tabular text-[13px] font-semibold ${riskClass(data.vix_change_pct)}`}>
              {fmtPct(data.vix_change_pct)}
            </span>
          </span>
        </div>
        <p className="mt-0.5 text-xs text-faint">
          VIX（恐慌指数，数字越高说明市场越紧张；回落通常对股票有利）
        </p>
      </div>


      <div className="grid gap-3 sm:grid-cols-2">
        <Block title="股指">
          {data.indices.length === 0 ? (
            <p className="micro-label px-3 py-2">数据暂不可用</p>
          ) : (
            data.indices.map((i) => (
              <Row
                key={i.name}
                label={i.name}
                change={fmtPct(i.change_pct)}
                changeValue={i.change_pct}
              />
            ))
          )}
        </Block>

        <Block title="汇率">
          {data.fx.length === 0 ? (
            <p className="micro-label px-3 py-2">数据暂不可用</p>
          ) : (
            data.fx.map((f) => (
              <Row
                key={f.pair}
                label={f.pair}
                value={fmtValue(f.value, 4)}
                change={fmtPct(f.change_pct)}
                changeValue={f.change_pct}
                inverse
              />
            ))
          )}
        </Block>

        <Block title="大宗商品">
          {data.commodities.length === 0 ? (
            <p className="micro-label px-3 py-2">数据暂不可用</p>
          ) : (
            data.commodities.map((c) => (
              <Row
                key={c.name}
                label={c.name}
                value={fmtValue(c.value)}
                change={fmtPct(c.change_pct)}
                changeValue={c.change_pct}
              />
            ))
          )}
        </Block>

        <Block title="债券收益率">
          {data.bond_yields.length === 0 ? (
            <p className="micro-label px-3 py-2">数据暂不可用</p>
          ) : (
            data.bond_yields.map((b) => (
              <Row
                key={b.name}
                label={b.name}
                value={`${b.value.toFixed(2)}%`}
                change={fmtBp(b.change_bp)}
                changeValue={b.change_bp}
                inverse
              />
            ))
          )}
        </Block>
      </div>

      <p className="text-xs leading-relaxed text-faint">
        说明：bp 是基点，1bp = 0.01%。此处只呈现数值与涨跌幅，方向解读见头条与执行摘要。
      </p>
    </div>
  );
}
