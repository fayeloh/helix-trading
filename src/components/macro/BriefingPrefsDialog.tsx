import { Plus, Search, Settings2, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBriefingPrefs } from "@/lib/briefing-prefs";
import {
  KEYWORD_MAX_COUNT,
  filterMarketGroups,
  filterSectors,
  normalizeKeyword,
} from "@/lib/macro-briefing.markets";

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-border bg-surface/50 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function BriefingPrefsDialog() {
  const { prefs, toggleMarket, toggleSector, addKeyword, removeKeyword, clear } =
    useBriefingPrefs();
  const keywords = prefs.keywords ?? [];
  const count = prefs.markets.length + prefs.sectors.length + keywords.length;

  const [query, setQuery] = useState("");
  const normalized = normalizeKeyword(query);
  const markets = filterMarketGroups(query);
  const sectors = filterSectors(query);
  const canAdd =
    normalized.length > 0 &&
    keywords.length < KEYWORD_MAX_COUNT &&
    !keywords.some((k) => k.toLowerCase() === normalized.toLowerCase());

  const submit = () => {
    if (!canAdd) return;
    if (addKeyword(normalized)) setQuery("");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Settings2 className="h-3.5 w-3.5" />
          关注设置
          {count > 0 ? <span className="text-primary">· {count}</span> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>关注的市场与板块</DialogTitle>
          <DialogDescription>
            搜索或直接输入你关注的市场、板块、标的。简报会把相关内容排在前面，并在执行摘要开头单独归纳它们的当日表现。设置保存在本机浏览器。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="搜索或输入，例如 英伟达、TSLA、新能源"
                aria-label="搜索关注的市场或板块"
                className="h-9 pl-8 text-sm"
              />
            </div>
            {normalized.length > 0 ? (
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-7 gap-1 text-xs"
                  disabled={!canAdd}
                  onClick={submit}
                >
                  <Plus className="h-3 w-3" />
                  添加“{normalized}”为自定义关注
                </Button>
                {!canAdd ? (
                  <span className="text-xs text-muted-foreground">
                    {keywords.length >= KEYWORD_MAX_COUNT ? "已达上限" : "已添加"}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {keywords.length > 0 ? (
            <section>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                我的自定义关注
              </p>
              <div className="flex flex-wrap gap-2">
                {keywords.map((k) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {k}
                    <button
                      type="button"
                      onClick={() => removeKeyword(k)}
                      aria-label={`删除 ${k}`}
                      className="rounded-full p-0.5 hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              市场
            </p>
            {markets.length === 0 ? (
              <p className="text-xs text-muted-foreground">没有匹配的预设市场，可直接添加为自定义关注。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {markets.map((g) => (
                  <Chip
                    key={g.key}
                    label={g.label}
                    active={prefs.markets.includes(g.key)}
                    onClick={() => toggleMarket(g.key)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              板块
            </p>
            {sectors.length === 0 ? (
              <p className="text-xs text-muted-foreground">没有匹配的预设板块，可直接添加为自定义关注。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sectors.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    active={prefs.sectors.includes(s)}
                    onClick={() => toggleSector(s)}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-xs" onClick={clear}>
              全部清除
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
