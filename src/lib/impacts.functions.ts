import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const targetSchema = z.object({
  target: z.string(),
  direction: z.string().optional(),
  reasoning: z.string().optional(),
});

export const recordEventImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        accountId: z.string().uuid().nullable().optional(),
        briefingId: z.string().uuid().nullable().optional(),
        eventKind: z.enum(["headline", "econ", "earnings"]),
        title: z.string().min(1),
        publishedAt: z.string().nullable().optional(),
        source: z.string().nullable().optional(),
        direction: z.string().default("unknown"),
        sectors: z.array(z.string()).default([]),
        targets: z.array(targetSchema).default([]),
        extraSymbols: z.array(z.string()).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { computeBaseline } = await import("./impacts.build.server");
    const { supabase, userId } = context;

    let holdings: {
      symbol: string;
      market: string;
      quantity: number;
      avg_cost: number;
      sector: string | null;
    }[] = [];
    if (data.accountId) {
      const { data: rows } = await supabase
        .from("holdings")
        .select("symbol, market, quantity, avg_cost, sector")
        .eq("account_id", data.accountId);
      holdings = (rows ?? []) as typeof holdings;
    }

    const { symbols, baseline } = await computeBaseline({
      targets: data.targets,
      sectors: data.sectors,
      extraSymbols: data.extraSymbols,
      holdings,
    });

    const { data: inserted, error } = await supabase
      .from("event_impacts")
      .insert({
        user_id: userId,
        account_id: data.accountId ?? null,
        source_briefing_id: data.briefingId ?? null,
        event_kind: data.eventKind,
        title: data.title,
        published_at: data.publishedAt ?? null,
        source: data.source ?? null,
        direction: data.direction,
        impact_targets: data.targets as never,
        symbols,
        baseline: baseline as never,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const listEventImpacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { reviewRows } = await import("./impacts.build.server");
    const { data: rows, error } = await context.supabase
      .from("event_impacts")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return await reviewRows(rows ?? []);
  });

export const deleteEventImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("event_impacts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateImpactNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("event_impacts")
      .update({ note: data.note })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
