import { Link, useRouterState } from "@tanstack/react-router";
import { CandlestickChart } from "lucide-react";

import { NAV, isNavActive } from "@/components/nav-items";
import { useBaseCurrency } from "@/lib/base-currency";
import { useLang } from "@/lib/i18n";
import { parseEt } from "@/lib/time-format";
import { useTimezone } from "@/lib/timezone";

import { BriefingPrefsDialog } from "./BriefingPrefsDialog";
import { RefreshOptionsDialog } from "./RefreshOptionsDialog";
import { TimezoneSelect } from "./TimezoneSelect";

/** 「更新于 X 分钟前」文案；无法解析时返回空。 */
function agoLabel(fetchedAt?: string): string {
  const instant = fetchedAt ? parseEt(fetchedAt) : null;
  if (!instant) return "";
  const mins = Math.max(0, Math.round((Date.now() - instant.getTime()) / 60000));
  if (mins < 1) return "刚刚更新";
  if (mins < 60) return `更新于 ${mins} 分钟前`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `更新于 ${hours} 小时前`;
  return `更新于 ${Math.round(hours / 24)} 天前`;
}

type Props = {
  date?: string | undefined;
  fetchedAt?: string | undefined;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function MacroBriefingHeader({ date, fetchedAt, onRefresh, refreshing }: Props) {
  const { label } = useTimezone();
  const { label: ccyLabel } = useBaseCurrency();
  const { t } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ago = agoLabel(fetchedAt);

  return (
    <header className="scanline sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 pt-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/"
            aria-label="Helix Trading"
            className="grid size-7 shrink-0 place-items-center rounded-sm bg-primary text-primary-foreground"
          >
            <CandlestickChart className="size-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">
              每日宏观简报
            </h1>
            <p className="micro-label truncate">
              {date ?? "—"}（美东交易日） · {label} · {ccyLabel}
              {ago ? ` · ${ago}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh ? (
            <RefreshOptionsDialog onConfirm={onRefresh} refreshing={refreshing} />
          ) : null}
          <BriefingPrefsDialog />
          <TimezoneSelect />
        </div>
      </div>

      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
        {NAV.map((item) => {
          const active = isNavActive(item.to, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors ${
                active
                  ? "text-foreground after:absolute after:inset-x-1.5 after:bottom-0 after:h-[2px] after:bg-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <item.icon className={`size-3.5 ${active ? "text-primary" : ""}`} />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <p className="mx-auto max-w-5xl px-4 pb-2 text-xs leading-relaxed text-faint">
        数据源发布时间以美国东部时间为准，页面已按你选择的时区换算。
      </p>
    </header>
  );
}

