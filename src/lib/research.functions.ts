import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_MODEL_DEEP } from "./ai.server";
import { generateResearchSection } from "./research.server";

const FUNDAMENTALS_PIPELINE_VERSION = "fundamentals-debate-v2";

export const getResearchSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        symbol: z.string().min(1).max(20),
        market: z.enum(["US", "HK", "CN", "CRYPTO", "OTHER"]),
        section: z.enum(["fundamentals", "earnings", "cycle", "flows"]),
        lookbackDays: z.number().int().min(30).max(365).default(90),
        lang: z.enum(["zh", "en"]).default("zh"),
        force: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const symbol = data.symbol.trim().toUpperCase();

    if (!data.force) {
      const { data: cached } = await context.supabase
        .from("research_reports")
        .select("*")
        .eq("symbol", symbol)
        .eq("market", data.market)
        .eq("section", data.section)
        .eq("lookback_days", data.lookbackDays)
        .eq("lang", data.lang)
        .gt("expires_at", new Date().toISOString())
        .order("generated_at", { ascending: false })
        .limit(1);
      if (cached && cached.length > 0) {
        const row = cached[0];
        const profile =
          data.section === "fundamentals" &&
          row?.payload &&
          typeof row.payload === "object" &&
          !Array.isArray(row.payload)
            ? row.payload["company_profile"]
            : null;
        const hasVerifiedIdentity =
          data.section !== "fundamentals" ||
          (profile &&
            typeof profile === "object" &&
            !Array.isArray(profile) &&
            "legal_name" in profile &&
            Boolean(profile["legal_name"]));
        const currentPipeline =
          data.section !== "fundamentals" ||
          (row?.payload &&
            typeof row.payload === "object" &&
            !Array.isArray(row.payload) &&
            row.payload["_pipeline_version"] === FUNDAMENTALS_PIPELINE_VERSION);
        if (row && hasVerifiedIdentity && currentPipeline) return row;
      }
    }

    const payload = await generateResearchSection({
      symbol,
      market: data.market,
      section: data.section,
      lookbackDays: data.lookbackDays,
      lang: data.lang,
    });

    const { data: inserted, error } = await context.supabase
      .from("research_reports")
      .insert({
        user_id: context.userId,
        symbol,
        market: data.market,
        section: data.section,
        lookback_days: data.lookbackDays,
        lang: data.lang,
        payload: (data.section === "fundamentals"
          ? { ...payload, _pipeline_version: FUNDAMENTALS_PIPELINE_VERSION }
          : payload) as never,
        model: AI_MODEL_DEEP,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const listRecentResearch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("research_reports")
      .select("symbol, market, generated_at")
      .order("generated_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
