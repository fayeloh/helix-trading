import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getAttributionsData,
  getChartData,
  getIndexBoardData,
  getQuotesData,
} from "./market-api.server";

const boardInput = z
  .object({
    defs: z
      .array(z.object({ symbol: z.string().min(1), label: z.string().min(1), group: z.string() }))
      .max(60)
      .optional(),
  })
  .optional();

export const getIndexBoard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => boardInput.parse(data))
  .handler(async ({ data }) => {
    return await getIndexBoardData(data?.defs);
  });

export const getIndexAttributions = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => boardInput.parse(data))
  .handler(async ({ data }) => {
    return await getAttributionsData(data?.defs);
  });

export const getChart = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ symbol: z.string().min(1), range: z.string().default("1M") }).parse(data),
  )
  .handler(async ({ data }) => {
    return await getChartData(data.symbol, data.range);
  });

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        items: z.array(z.object({ symbol: z.string().min(1), market: z.string() })).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    return await getQuotesData(data.items);
  });
