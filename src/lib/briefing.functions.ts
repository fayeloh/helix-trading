import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_MODEL_FAST } from "./ai.server";
import { generateMacroBriefing, generatePortfolioBriefing, type HoldingRow } from "./briefing.server";
import { stableHash } from "./hash.server";

export const listBriefings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ accountId: z.string().uuid().nullable().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("briefings")
      .select("*")
      .order("briefing_date", { ascending: false })
      .order("generated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (rows ?? []).filter(
      (r) => r.briefing_type === "macro" || !data.accountId || r.account_id === data.accountId,
    );
  });

export const generateBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        accountId: z.string().uuid().nullable(),
        type: z.enum(["macro", "portfolio"]),
        lang: z.enum(["zh", "en"]).default("zh"),
        force: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("display_timezone, base_currency")
      .eq("id", context.userId)
      .maybeSingle();
    const timezone = profile?.display_timezone ?? "Asia/Shanghai";
    const baseCurrency = profile?.base_currency ?? "USD";

    let holdings: HoldingRow[] = [];
    if (data.type === "portfolio") {
      if (!data.accountId) throw new Error("请先选择一个账户");
      const { data: rows, error } = await context.supabase
        .from("holdings")
        .select("symbol, display_name, market, currency, quantity, avg_cost, sector, industry_tags")
        .eq("account_id", data.accountId);
      if (error) throw new Error(error.message);
      holdings = (rows ?? []) as HoldingRow[];
      if (holdings.length === 0) throw new Error("该账户暂无持仓，请先录入或导入持仓");
    }

    const hash = data.type === "portfolio" ? stableHash(holdings) : "global";

    if (!data.force) {
      // 实时简报：同账户同语言 15 分钟内复用，超过则重新抓取新闻并重算。
      const freshSince = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const query = context.supabase
        .from("briefings")
        .select("*")
        .eq("briefing_type", data.type)
        .eq("briefing_date", today)
        .eq("holdings_hash", hash)
        .eq("lang", data.lang)
        .gte("generated_at", freshSince)
        .order("generated_at", { ascending: false })
        .limit(1);
      const { data: cached } = data.accountId && data.type === "portfolio"
        ? await query.eq("account_id", data.accountId)
        : await query;
      if (cached && cached.length > 0) return cached[0]!;
    }

    const payload =
      data.type === "macro"
        ? await generateMacroBriefing(timezone, data.lang)
        : await generatePortfolioBriefing(holdings, timezone, baseCurrency, data.lang);

    const { data: inserted, error: insertError } = await context.supabase
      .from("briefings")
      .insert({
        user_id: context.userId,
        account_id: data.type === "portfolio" ? data.accountId : null,
        briefing_type: data.type,
        briefing_date: today,
        holdings_hash: hash,
        lang: data.lang,
        payload: payload as never,
        model: AI_MODEL_FAST,
      })
      .select()
      .single();
    if (insertError) throw new Error(insertError.message);
    return inserted;
  });
