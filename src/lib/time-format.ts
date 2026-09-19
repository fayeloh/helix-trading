/**
 * 简报时间格式化：数据源时间以美国东部时间（America/New_York）为口径，
 * 展示时换算到用户选择的时区。纯函数，无副作用，便于单测。
 */

export const ET_ZONE = "America/New_York";

export type TimezoneOption = {
  /** IANA 时区 id。 */
  id: string;
  /** 中文标签。 */
  label: string;
};

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { id: "Asia/Shanghai", label: "北京 / 上海" },
  { id: "Asia/Hong_Kong", label: "香港" },
  { id: "Asia/Singapore", label: "新加坡" },
  { id: "Asia/Tokyo", label: "东京" },
  { id: "Europe/London", label: "伦敦" },
  { id: "America/New_York", label: "美国东部" },
  { id: "America/Los_Angeles", label: "美国西部" },
  { id: "UTC", label: "协调世界时" },
];

const ZONE_NAMES: Record<string, string> = Object.fromEntries(
  TIMEZONE_OPTIONS.map((o) => [o.id, o.label]),
);

/** 该时区在给定绝对时刻的 UTC 偏移（分钟）。 */
function zoneOffsetMinutes(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(parts["year"]),
    Number(parts["month"]) - 1,
    Number(parts["day"]),
    Number(parts["hour"]) === 24 ? 0 : Number(parts["hour"]),
    Number(parts["minute"]),
    Number(parts["second"]),
  );
  // 抹掉毫秒差，保证偏移是整数分钟。
  return Math.round((asUtc - instant.getTime()) / 60000);
}

const RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;

/** 把 `YYYY-MM-DD HH:mm`（美东挂钟时间）解析为绝对时刻；无法解析时返回 null。 */
export function parseEt(value: string, zone: string = ET_ZONE): Date | null {
  const m = RE.exec((value ?? "").trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  // 两次迭代足以收敛（含夏令时切换）。
  let instant = new Date(naive);
  for (let i = 0; i < 2; i += 1) {
    const off = zoneOffsetMinutes(instant, zone);
    instant = new Date(naive - off * 60000);
  }
  return instant;
}

/** UTC 偏移文案，例如 `UTC+8`、`UTC-4`、`UTC`。 */
export function offsetLabel(tz: string, at: Date = new Date()): string {
  const off = Math.round(zoneOffsetMinutes(at, tz));
  if (off === 0) return "UTC";
  const sign = off > 0 ? "+" : "-";
  const abs = Math.abs(off);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** 时区标签，例如 `上海时间 (UTC+8)`。 */
export function zoneLabel(tz: string, at: Date = new Date()): string {
  const name = ZONE_NAMES[tz] ?? tz;
  return `${name}时间（${offsetLabel(tz, at)}）`;
}

/** 短标签，用于时间后缀，例如 `上海 UTC+8`。 */
export function zoneShortLabel(tz: string, at: Date = new Date()): string {
  const name = ZONE_NAMES[tz] ?? tz;
  return `${name} ${offsetLabel(tz, at)}`;
}

/** 把美东口径时间字符串换算到目标时区，输出 `MM-DD HH:mm`；无法解析时原样返回。 */
export function formatInZone(value: string, tz: string): string {
  const instant = parseEt(value);
  if (!instant) return value;
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  const hour = p["hour"] === "24" ? "00" : p["hour"];
  return `${p["month"]}-${p["day"]} ${hour}:${p["minute"]}`;
}

/** 完整日期 + 时间，例如 `2026-08-27 08:30`。 */
export function formatFullInZone(value: string, tz: string): string {
  const instant = parseEt(value);
  if (!instant) return value;
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  const hour = p["hour"] === "24" ? "00" : p["hour"];
  return `${p["year"]}-${p["month"]}-${p["day"]} ${hour}:${p["minute"]}`;
}

/** 浏览器时区；不可用时回落到美东。 */
export function detectZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || ET_ZONE;
  } catch {
    return ET_ZONE;
  }
}
