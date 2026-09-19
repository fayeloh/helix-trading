import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Plus, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MARKETS, type MarketCode } from "@/lib/constants";
import { fmtPct, toneClass } from "@/lib/portfolio";

type ChecklistItem = { label: string; checked: boolean };

type Entry = {
  id: string;
  symbol: string;
  market: string;
  direction: string;
  status: string;
  thesis: string | null;
  entry_reason: string | null;
  exit_reason: string | null;
  planned_stop: number | null;
  planned_target: number | null;
  max_position_pct: number | null;
  checklist: ChecklistItem[];
  emotion: string | null;
  review_notes: string | null;
  outcome_pct: number | null;
  discipline_score: number | null;
  opened_at: string;
  closed_at: string | null;
};

const EMOTIONS = ["冷静执行", "FOMO 追高", "恐慌", "报复性交易", "犹豫不决"];

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "交易日志与纪律 checklist — Helix Trading" },
      {
        name: "description",
        content:
          "买入卖出理由记录、交易前 checklist、仓位与止损计划、情绪标记、事后复盘与胜率统计，把交易纪律固化成流程。",
      },
      { property: "og:title", content: "交易日志与纪律 — Helix Trading" },
      { property: "og:description", content: "结构化交易记录、checklist 与复盘胜率统计。" },
    ],
  }),
  component: JournalPage,
});

function JournalPage() {
  const { user } = useAuth();
  const { activeAccountId, isLoading: accountsLoading } = useAccounts();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const openNewEntry = () => {
    if (!user) {
      toast.error("请先登录");
      navigate({ to: "/auth" });
      return;
    }
    if (accountsLoading) {
      toast.info("交易账户正在加载，请稍后再试");
      return;
    }
    if (!activeAccountId) {
      toast.error("请先创建或选择一个交易账户");
      navigate({ to: "/accounts" });
      return;
    }
    setOpen(true);
  };

  const templates = useQuery({
    queryKey: ["checklist-templates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_templates")
        .select("id, name, items, is_default")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const rules = useQuery({
    queryKey: ["risk-rules", user?.id, activeAccountId],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_rules")
        .select("max_position_pct, max_sector_pct, default_stop_pct, max_open_positions")
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const entries = useQuery({
    queryKey: ["journal", user?.id, activeAccountId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("journal_entries")
        .select("*")
        .order("opened_at", { ascending: false })
        .limit(200);
      if (activeAccountId) q = q.eq("account_id", activeAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Entry[];
    },
  });

  const rows = entries.data ?? [];
  const closed = rows.filter((r) => r.status === "closed" && r.outcome_pct != null);
  const wins = closed.filter((r) => (r.outcome_pct ?? 0) > 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : null;
  const avgWin = wins.length ? wins.reduce((s, r) => s + (r.outcome_pct ?? 0), 0) / wins.length : null;
  const losses = closed.filter((r) => (r.outcome_pct ?? 0) <= 0);
  const avgLoss = losses.length
    ? losses.reduce((s, r) => s + (r.outcome_pct ?? 0), 0) / losses.length
    : null;
  const disciplineScores = rows.filter((r) => r.discipline_score != null);
  const avgDiscipline = disciplineScores.length
    ? disciplineScores.reduce((s, r) => s + (r.discipline_score ?? 0), 0) / disciplineScores.length
    : null;

  const create = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (!user) throw new Error("请先登录");
      if (!activeAccountId) throw new Error("请先创建或选择一个交易账户");
      const { error } = await supabase.from("journal_entries").insert({
        ...payload,
        user_id: user.id,
        account_id: activeAccountId,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("已记录交易");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["journal"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "保存失败"),
  });

  const update = useMutation({
    mutationFn: async (vars: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("journal_entries")
        .update(vars.patch as never)
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "更新失败"),
  });

  const defaultChecklist =
    (templates.data?.find((t) => t.is_default)?.items as unknown as
      | { label: string }[]
      | string[]
      | undefined) ?? [];

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">交易日志与纪律</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              每笔交易都要有理由、checklist、止损与仓位上限，收盘后复盘。
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button size="sm" onClick={openNewEntry}>
              <Plus className="mr-1 size-3.5" />
              新建交易记录
            </Button>
            <NewEntryDialog
              checklistSource={defaultChecklist}
              defaultStopPct={rules.data?.default_stop_pct ?? 8}
              defaultMaxPct={rules.data?.max_position_pct ?? 15}
              pending={create.isPending}
              onSubmit={(payload) => create.mutate(payload)}
            />
          </Dialog>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="已平仓笔数" value={String(closed.length)} />
          <StatCard label="胜率" value={winRate == null ? "—" : `${winRate.toFixed(1)}%`} />
          <StatCard
            label="平均盈亏"
            value={`${avgWin == null ? "—" : fmtPct(avgWin)} / ${avgLoss == null ? "—" : fmtPct(avgLoss)}`}
          />
          <StatCard
            label="平均纪律分"
            value={avgDiscipline == null ? "—" : `${avgDiscipline.toFixed(1)} / 10`}
          />
        </div>

        {rules.data ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Target className="size-4 text-primary" />
                风险规则
              </CardTitle>
            </CardHeader>
            <CardContent className="tabular flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              <span>单标的仓位上限 {rules.data.max_position_pct}%</span>
              <span>单板块上限 {rules.data.max_sector_pct}%</span>
              <span>默认止损 {rules.data.default_stop_pct}%</span>
              <span>最多同时持仓 {rules.data.max_open_positions} 个</span>
            </CardContent>
          </Card>
        ) : null}

        <div className="space-y-3">
          {rows.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                还没有交易记录。先在账户页录入持仓，然后为每笔决策建立日志。
              </CardContent>
            </Card>
          ) : (
            rows.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                onClose={(patch) => update.mutate({ id: e.id, patch })}
                onToggleItem={(idx) => {
                  const next = (e.checklist ?? []).map((it, i) =>
                    i === idx ? { ...it, checked: !it.checked } : it,
                  );
                  update.mutate({ id: e.id, patch: { checklist: next } });
                }}
              />
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="tabular mt-1 text-lg font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function NewEntryDialog({
  checklistSource,
  defaultStopPct,
  defaultMaxPct,
  pending,
  onSubmit,
}: {
  checklistSource: { label: string }[] | string[];
  defaultStopPct: number;
  defaultMaxPct: number;
  pending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const initial: ChecklistItem[] = (checklistSource as unknown[]).map((it) =>
    typeof it === "string" ? { label: it, checked: false } : { label: (it as { label: string }).label, checked: false },
  );

  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState<MarketCode>("US");
  const [direction, setDirection] = useState("long");
  const [thesis, setThesis] = useState("");
  const [entryReason, setEntryReason] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [maxPct, setMaxPct] = useState(String(defaultMaxPct));
  const [emotion, setEmotion] = useState(EMOTIONS[0]!);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    initial.length
      ? initial
      : [
          { label: "买入理由可以用一句话说清", checked: false },
          { label: "已确认下一次财报/重大事件日期", checked: false },
          { label: "已设定止损与最大仓位", checked: false },
          { label: "不是情绪驱动的追高或报复交易", checked: false },
        ],
  );

  const allChecked = checklist.every((c) => c.checked);

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>新建交易记录</DialogTitle>
        <DialogDescription>
          先完成 checklist 再保存。记录不会执行任何下单操作。
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <Label className="text-xs">代码</Label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="tabular mt-1"
            />
          </div>
          <div>
            <Label className="text-xs">市场</Label>
            <Select value={market} onValueChange={(v) => setMarket(v as MarketCode)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">方向</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="long">做多</SelectItem>
                <SelectItem value="short">做空</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">情绪标记</Label>
            <Select value={emotion} onValueChange={setEmotion}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMOTIONS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs">交易论点（thesis）</Label>
          <Textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            className="mt-1"
            rows={2}
            placeholder="基本面/事件依据，以及什么情况下论点失效"
          />
        </div>
        <div>
          <Label className="text-xs">买入理由</Label>
          <Textarea
            value={entryReason}
            onChange={(e) => setEntryReason(e.target.value)}
            className="mt-1"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">计划止损价</Label>
            <Input
              value={stop}
              onChange={(e) => setStop(e.target.value)}
              className="tabular mt-1"
              placeholder={`-${defaultStopPct}%`}
            />
          </div>
          <div>
            <Label className="text-xs">目标价</Label>
            <Input value={target} onChange={(e) => setTarget(e.target.value)} className="tabular mt-1" />
          </div>
          <div>
            <Label className="text-xs">仓位上限 %</Label>
            <Input value={maxPct} onChange={(e) => setMaxPct(e.target.value)} className="tabular mt-1" />
          </div>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium">
            <ClipboardList className="size-3.5 text-primary" />
            交易前 checklist
          </p>
          <div className="space-y-2">
            {checklist.map((c, i) => (
              <label key={i} className="flex items-start gap-2 text-xs">
                <Checkbox
                  checked={c.checked}
                  onCheckedChange={() =>
                    setChecklist((p) => p.map((it, j) => (j === i ? { ...it, checked: !it.checked } : it)))
                  }
                />
                <span className={c.checked ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </label>
            ))}
          </div>
          {!allChecked ? (
            <p className="mt-2 text-[11px] text-warn">尚有未确认项，仍可保存但会标记纪律缺口。</p>
          ) : null}
        </div>

        <Button
          className="w-full"
          disabled={pending || !symbol.trim()}
          onClick={() =>
            onSubmit({
              symbol: symbol.trim().toUpperCase(),
              market,
              direction,
              status: "open",
              thesis: thesis || null,
              entry_reason: entryReason || null,
              planned_stop: stop ? Number(stop) : null,
              planned_target: target ? Number(target) : null,
              max_position_pct: maxPct ? Number(maxPct) : null,
              checklist,
              emotion,
              discipline_score: Math.round(
                (checklist.filter((c) => c.checked).length / Math.max(1, checklist.length)) * 10,
              ),
            })
          }
        >
          {pending ? "保存中…" : "保存记录"}
        </Button>
      </div>
    </DialogContent>
  );
}

function EntryCard({
  entry,
  onClose,
  onToggleItem,
}: {
  entry: Entry;
  onClose: (patch: Record<string, unknown>) => void;
  onToggleItem: (idx: number) => void;
}) {
  const [outcome, setOutcome] = useState("");
  const [exitReason, setExitReason] = useState("");
  const [review, setReview] = useState("");

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="tabular flex items-center gap-2 text-sm">
              {entry.symbol}
              <Badge variant="outline" className="text-[10px]">
                {entry.market}
              </Badge>
              <Badge variant={entry.status === "open" ? "default" : "secondary"} className="text-[10px]">
                {entry.status === "open" ? "持有中" : "已平仓"}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              开仓 {new Date(entry.opened_at).toLocaleDateString("zh-CN")}
              {entry.closed_at ? ` · 平仓 ${new Date(entry.closed_at).toLocaleDateString("zh-CN")}` : ""}
              {entry.emotion ? ` · 情绪 ${entry.emotion}` : ""}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className={`tabular text-sm font-semibold ${toneClass(entry.outcome_pct)}`}>
              {entry.outcome_pct == null ? "—" : fmtPct(entry.outcome_pct)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              纪律分 {entry.discipline_score ?? "—"}/10
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {entry.thesis ? (
          <p className="text-sm leading-relaxed">
            <span className="text-muted-foreground">论点：</span>
            {entry.thesis}
          </p>
        ) : null}
        {entry.entry_reason ? (
          <p className="text-sm leading-relaxed">
            <span className="text-muted-foreground">买入理由：</span>
            {entry.entry_reason}
          </p>
        ) : null}
        <div className="tabular flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
          <span>止损 {entry.planned_stop ?? "—"}</span>
          <span>目标 {entry.planned_target ?? "—"}</span>
          <span>仓位上限 {entry.max_position_pct ?? "—"}%</span>
        </div>

        {(entry.checklist ?? []).length > 0 ? (
          <div className="rounded-md bg-muted/40 p-2.5">
            {entry.checklist.map((c, i) => (
              <label key={i} className="flex items-start gap-2 py-0.5 text-[11px]">
                <Checkbox checked={c.checked} onCheckedChange={() => onToggleItem(i)} />
                <span className={c.checked ? "" : "text-muted-foreground"}>{c.label}</span>
              </label>
            ))}
          </div>
        ) : null}

        {entry.status === "open" ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="text-xs font-medium">平仓复盘</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="盈亏 %"
                className="tabular"
              />
              <Input
                value={exitReason}
                onChange={(e) => setExitReason(e.target.value)}
                placeholder="卖出理由"
                className="sm:col-span-2"
              />
            </div>
            <Textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              rows={2}
              placeholder="复盘：论点是否成立？纪律是否被打破？下次改什么？"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                onClose({
                  status: "closed",
                  closed_at: new Date().toISOString(),
                  outcome_pct: outcome ? Number(outcome) : null,
                  exit_reason: exitReason || null,
                  review_notes: review || null,
                })
              }
            >
              <CheckCircle2 className="mr-1 size-3.5" />
              标记为已平仓
            </Button>
          </div>
        ) : entry.review_notes ? (
          <div className="rounded-md bg-muted/40 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">复盘：</span>
            {entry.review_notes}
            {entry.exit_reason ? ` · 卖出理由：${entry.exit_reason}` : ""}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
