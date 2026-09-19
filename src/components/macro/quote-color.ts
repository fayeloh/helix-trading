/** 涨跌配色：国际惯例（涨绿 / 跌红），颜色来自 styles.css 的 quote token。 */
export function quoteClass(v: number) {
  if (v > 0) return "text-quote-up";
  if (v < 0) return "text-quote-down";
  return "text-muted-foreground";
}

/** 反向指标（如 VIX）：下行代表风险偏好回升，用涨色。 */
export function riskClass(v: number) {
  if (v < 0) return "text-quote-up";
  if (v > 0) return "text-quote-down";
  return "text-muted-foreground";
}

export function fmtPct(v: number, digits = 2) {
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

export function fmtBp(v: number) {
  return `${v > 0 ? "+" : ""}${v}bp`;
}

export function fmtValue(v: number, digits = 2) {
  return v.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
