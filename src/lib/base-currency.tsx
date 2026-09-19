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

const STORAGE_KEY = "helix.base-ccy";

export type BaseCurrency = "USD" | "CNY" | "HKD";

export const CURRENCY_OPTIONS: { id: BaseCurrency; label: string }[] = [
  { id: "USD", label: "美元 USD" },
  { id: "CNY", label: "人民币 CNY" },
  { id: "HKD", label: "港币 HKD" },
];

const NAMES: Record<BaseCurrency, string> = {
  USD: "美元 USD",
  CNY: "人民币 CNY",
  HKD: "港币 HKD",
};

export function currencyLabel(c: BaseCurrency): string {
  return NAMES[c] ?? c;
}

function isCurrency(v: string | null): v is BaseCurrency {
  return v === "USD" || v === "CNY" || v === "HKD";
}

type Ctx = {
  /** 阅读基准币种（仅用于标注计价单位，不做汇率换算）。 */
  currency: BaseCurrency;
  setCurrency: (c: BaseCurrency) => void;
  /** 例如「美元 USD」。 */
  label: string;
};

// 与时区 context 同样的做法：跨路由分包 / 热更新保持同一 context 实例。
const CONTEXT_KEY = Symbol.for("helix-trading.base-currency-context");
const registry = globalThis as typeof globalThis & {
  [CONTEXT_KEY]?: Context<Ctx | null>;
};
const Store = registry[CONTEXT_KEY] ?? createContext<Ctx | null>(null);
registry[CONTEXT_KEY] = Store;

export function BaseCurrencyProvider({ children }: { children: ReactNode }) {
  // SSR 首帧固定 USD，挂载后再读本地设置，避免 hydration 不一致。
  const [currency, setState] = useState<BaseCurrency>("USD");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isCurrency(stored)) setState(stored);
  }, []);

  const setCurrency = useCallback((c: BaseCurrency) => {
    setState(c);
    try {
      window.localStorage.setItem(STORAGE_KEY, c);
    } catch {
      /* 本地存储不可用时仅保留内存状态 */
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ currency, setCurrency, label: currencyLabel(currency) }),
    [currency, setCurrency],
  );

  return <Store.Provider value={value}>{children}</Store.Provider>;
}

/** 无 Provider 时回落到美元口径。 */
export function useBaseCurrency(): Ctx {
  const ctx = useContext(Store);
  if (ctx) return ctx;
  return { currency: "USD", setCurrency: () => {}, label: currencyLabel("USD") };
}
