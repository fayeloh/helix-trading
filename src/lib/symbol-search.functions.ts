import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { searchSymbols } from "./symbol-search.server";

export const searchSymbolSuggestions = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ q: z.string().min(1).max(40) }).parse(data))
  .handler(async ({ data }) => {
    return { items: await searchSymbols(data.q) };
  });
