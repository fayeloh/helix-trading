import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Context,
  type ReactNode,
} from "react";

import {
  EMPTY_PREFS,
  KEYWORD_MAX_COUNT,
  MARKET_GROUPS,
  SECTOR_OPTIONS,
  normalizeKeyword,
  normalizeKeywords,
  type BriefingPrefs,
  type MarketKey,
} from "./macro-briefing.markets";

const STORAGE_KEY = "helix.briefing.prefs";

type PrefsCtx = {
  prefs: BriefingPrefs;
  toggleMarket: (key: MarketKey) => void;
  toggleSector: (sector: string) => void;
  /** 添加自定义关注关键词；返回是否成功（重复、为空或超上限时为 false）。 */
  addKeyword: (raw: string) => boolean;
  removeKeyword: (keyword: string) => void;
  clear: () => void;
};

// 与时区 context 同样的做法：跨路由分包 / 热更新保持同一 context 实例。
const CONTEXT_KEY = Symbol.for("helix-trading.briefing-prefs-context");
const registry = globalThis as typeof globalThis & {
  [CONTEXT_KEY]?: Context<PrefsCtx | null>;
};
const Ctx = registry[CONTEXT_KEY] ?? createContext<PrefsCtx | null>(null);
registry[CONTEXT_KEY] = Ctx;

const VALID_MARKETS = new Set<string>(MARKET_GROUPS.map((g) => g.key));

function parse(raw: string | null): BriefingPrefs {
  if (!raw) return EMPTY_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<BriefingPrefs>;
    const markets = (parsed.markets ?? []).filter((m): m is MarketKey => VALID_MARKETS.has(m));
    const sectors = (parsed.sectors ?? []).filter((s) => typeof s === "string" && s.length > 0);
    const keywords = normalizeKeywords(parsed.keywords);
    return { markets, sectors, keywords };
  } catch {
    return EMPTY_PREFS;
  }
}

export function BriefingPrefsProvider({ children }: { children: ReactNode }) {
  // SSR 首帧用空偏好，挂载后再读本地设置，避免 hydration 不一致。
  const [prefs, setPrefs] = useState<BriefingPrefs>(EMPTY_PREFS);

  useEffect(() => {
    setPrefs(parse(window.localStorage.getItem(STORAGE_KEY)));
  }, []);

  const persist = useCallback((next: BriefingPrefs) => {
    setPrefs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* 本地存储不可用时仅保留内存状态 */
    }
  }, []);

  const value = useMemo<PrefsCtx>(
    () => ({
      prefs,
      toggleMarket: (key) =>
        persist({
          ...prefs,
          markets: prefs.markets.includes(key)
            ? prefs.markets.filter((m) => m !== key)
            : [...prefs.markets, key],
        }),
      toggleSector: (sector) =>
        persist({
          ...prefs,
          sectors: prefs.sectors.includes(sector)
            ? prefs.sectors.filter((s) => s !== sector)
            : [...prefs.sectors, sector],
        }),
      addKeyword: (raw) => {
        const k = normalizeKeyword(raw);
        if (!k) return false;
        const existing = prefs.keywords ?? [];
        if (existing.length >= KEYWORD_MAX_COUNT) return false;
        if (existing.some((x) => x.toLowerCase() === k.toLowerCase())) return false;
        persist({ ...prefs, keywords: [...existing, k] });
        return true;
      },
      removeKeyword: (keyword) =>
        persist({
          ...prefs,
          keywords: (prefs.keywords ?? []).filter(
            (k) => k.toLowerCase() !== keyword.toLowerCase(),
          ),
        }),
      clear: () => persist(EMPTY_PREFS),
    }),
    [prefs, persist],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 无 Provider 时安全回落到空偏好。 */
export function useBriefingPrefs(): PrefsCtx {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  return {
    prefs: EMPTY_PREFS,
    toggleMarket: () => {},
    toggleSector: () => {},
    addKeyword: () => false,
    removeKeyword: () => {},
    clear: () => {},
  };
}

export { MARKET_GROUPS, SECTOR_OPTIONS };
