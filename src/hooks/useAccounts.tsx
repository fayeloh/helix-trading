import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Account = {
  id: string;
  name: string;
  broker: string | null;
  base_currency: string;
  timezone: string;
  notes: string | null;
  is_archived: boolean;
};

const STORAGE_KEY = "helix.activeAccountId";

type AccountsState = {
  accounts: Account[];
  activeAccount: Account | null;
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;
  isLoading: boolean;
  refetch: () => void;
};

const AccountsContext = createContext<AccountsState | null>(null);

export function AccountsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeAccountId, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") setActive(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["accounts", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, name, broker, base_currency, timezone, notes, is_archived")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Account[];
    },
  });

  /** Supabase 未配置时跳过查询（enabled 已由 user=null 保证），查询错误也不冒泡到错误边界。 */
  const accounts = useMemo(
    () => ((data ?? []) as Account[]).filter((a) => !a.is_archived),
    [data],
  );

  const resolvedId = useMemo(() => {
    if (activeAccountId && accounts.some((a) => a.id === activeAccountId)) return activeAccountId;
    return accounts[0]?.id ?? null;
  }, [activeAccountId, accounts]);

  const setActiveAccountId = (id: string | null) => {
    setActive(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AccountsContext.Provider
      value={{
        accounts,
        activeAccountId: resolvedId,
        activeAccount: accounts.find((a) => a.id === resolvedId) ?? null,
        setActiveAccountId,
        isLoading,
        refetch,
      }}
    >
      {children}
    </AccountsContext.Provider>
  );
}

export function useAccounts() {
  const ctx = useContext(AccountsContext);
  if (!ctx) throw new Error("useAccounts must be used inside AccountsProvider");
  return ctx;
}
