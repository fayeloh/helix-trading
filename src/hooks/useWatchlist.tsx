import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { INDEX_BOARD, type IndexDef } from "@/lib/constants";
import { useAuth } from "./useAuth";

export type WatchItem = IndexDef;

/**
 * 指数看板自定义列表（保存在数据库，跨设备一致）。
 * 未配置时回落到 INDEX_BOARD 默认列表。
 */
export function useWatchlist() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["watchlist", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<WatchItem[]> => {
      const { data, error } = await supabase
        .from("watchlist_indexes")
        .select("symbol, label, group, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        symbol: r.symbol,
        label: r.label,
        group: (r.group ?? "股指") as IndexDef["group"],
      }));
    },
  });

  const isCustom = (query.data?.length ?? 0) > 0;
  const items: WatchItem[] = isCustom ? query.data! : INDEX_BOARD;

  const save = useMutation({
    mutationFn: async (next: WatchItem[]) => {
      if (!user) throw new Error("请先登录");
      const { error: delError } = await supabase
        .from("watchlist_indexes")
        .delete()
        .eq("user_id", user.id);
      if (delError) throw delError;
      if (next.length > 0) {
        const { error } = await supabase.from("watchlist_indexes").insert(
          next.map((it, i) => ({
            user_id: user.id,
            symbol: it.symbol,
            label: it.label,
            group: it.group,
            sort_order: i,
          })),
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      qc.invalidateQueries({ queryKey: ["index-board"] });
      qc.invalidateQueries({ queryKey: ["index-attributions"] });
    },
  });

  return { items, isCustom, isLoading: query.isLoading, save };
}
