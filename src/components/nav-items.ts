import {
  BookOpenCheck,
  CandlestickChart,
  LayoutDashboard,
  Newspaper,
  Search,
} from "lucide-react";

/** 主导航项：AppShell 与公开的简报页头部共用。 */
export const NAV = [
  { to: "/", key: "nav.overview", icon: LayoutDashboard },
  { to: "/briefing", key: "nav.briefing", icon: Newspaper },
  { to: "/markets", key: "nav.markets", icon: CandlestickChart },
  { to: "/research", key: "nav.research", icon: Search },
  { to: "/journal", key: "nav.journal", icon: BookOpenCheck },
] as const;

export function isNavActive(to: string, pathname: string) {
  return to === "/" ? pathname === "/" : pathname.startsWith(to);
}
