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

import { ET_ZONE, detectZone, zoneLabel, zoneShortLabel } from "./time-format";

const STORAGE_KEY = "helix.tz";

type TimezoneCtx = {
  /** 生效的 IANA 时区 id。 */
  tz: string;
  /** 用户是否选择「自动识别」。 */
  auto: boolean;
  /** 传入 "auto" 表示跟随浏览器。 */
  setTz: (value: string) => void;
  /** 例如「上海时间（UTC+8）」。 */
  label: string;
  /** 例如「上海 UTC+8」。 */
  shortLabel: string;
};

// 与语言 context 同样的做法：跨路由分包 / 热更新保持同一 context 实例。
const CONTEXT_KEY = Symbol.for("helix-trading.timezone-context");
const registry = globalThis as typeof globalThis & {
  [CONTEXT_KEY]?: Context<TimezoneCtx | null>;
};
const Ctx = registry[CONTEXT_KEY] ?? createContext<TimezoneCtx | null>(null);
registry[CONTEXT_KEY] = Ctx;

export function TimezoneProvider({ children }: { children: ReactNode }) {
  // SSR 首帧统一使用美东口径，避免 hydration 不一致；挂载后再读取本地设置。
  const [choice, setChoice] = useState<string>(ET_ZONE);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setChoice(stored && stored.length > 0 ? stored : "auto");
  }, []);

  const setTz = useCallback((value: string) => {
    setChoice(value);
    window.localStorage.setItem(STORAGE_KEY, value);
  }, []);

  const value = useMemo<TimezoneCtx>(() => {
    const auto = choice === "auto";
    const tz = auto ? detectZone() : choice;
    return { tz, auto, setTz, label: zoneLabel(tz), shortLabel: zoneShortLabel(tz) };
  }, [choice, setTz]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 无 Provider 时回落到美东口径，保证任何位置都能安全调用。 */
export function useTimezone(): TimezoneCtx {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  return {
    tz: ET_ZONE,
    auto: false,
    setTz: () => {},
    label: zoneLabel(ET_ZONE),
    shortLabel: zoneShortLabel(ET_ZONE),
  };
}
