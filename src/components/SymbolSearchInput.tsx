import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { searchSymbolSuggestions } from "@/lib/symbol-search.functions";
import type { SymbolSuggestion } from "@/lib/symbol-search.server";

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** 选中某条联想结果时回调（点击或回车）。 */
  onSelect?: (s: SymbolSuggestion) => void;
  /** 输入框内直接回车（无选中项）时回调。 */
  onEnter?: () => void;
  placeholder?: string;
  className?: string;
  id?: string;
};

/** 带联想的标的代码输入框：输入 2 字符后开始搜索，250ms 防抖，支持上下键 + 回车。 */
export function SymbolSearchInput({
  value,
  onChange,
  onSelect,
  onEnter,
  placeholder,
  className,
  id,
}: Props) {
  const searchFn = useServerFn(searchSymbolSuggestions);
  const [debounced, setDebounced] = useState(value.trim());
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    const timer = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(timer);
  }, [value]);

  const enabled = debounced.length >= 2;
  const suggest = useQuery({
    queryKey: ["symbol-search", debounced],
    queryFn: async () => await searchFn({ data: { q: debounced } }),
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const items = enabled ? (suggest.data?.items ?? []) : [];

  useEffect(() => {
    setActive(-1);
  }, [debounced]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (s: SymbolSuggestion) => {
    onChange(s.symbol);
    setOpen(false);
    setActive(-1);
    onSelect?.(s);
  };

  const showList = open && enabled;

  return (
    <div ref={boxRef} className="relative">
      <Input
        id={id}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && items.length > 0) {
            e.preventDefault();
            setOpen(true);
            setActive((i) => (i + 1) % items.length);
          } else if (e.key === "ArrowUp" && items.length > 0) {
            e.preventDefault();
            setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
          } else if (e.key === "Enter") {
            const hit = items[active];
            if (showList && hit) {
              e.preventDefault();
              pick(hit);
            } else {
              setOpen(false);
              onEnter?.();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {showList ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {suggest.isFetching && items.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              搜索中…
            </div>
          ) : suggest.isError ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              搜索服务暂时不可用，仍可输入完整代码后直接研究。
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              未找到联想结果；若代码无误，可按回车直接验证。
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto py-1">
              {items.map((s, i) => (
                <li key={`${s.symbol}-${i}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(s)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs ${
                      i === active ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="tabular font-medium">{s.symbol}</span>
                      <span className="ml-2 truncate text-muted-foreground">{s.name}</span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {s.type}
                      {s.exchange ? ` · ${s.exchange}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
