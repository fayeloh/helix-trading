import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAccounts } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CURRENCIES, MARKETS } from "@/lib/constants";
import { getQuotes } from "@/lib/market.functions";
import {
  CSV_TEMPLATE,
  buildPortfolio,
  fmtMoney,
  fmtNum,
  fmtPct,
  parseHoldingsCsv,
  toneClass,
  type Holding,
} from "@/lib/portfolio";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "账户与持仓 — Helix Trading" },
      {
        name: "description",
        content:
          "在 Helix Trading 管理多个交易账户，手动录入或 CSV 导入美股、港股与加密货币持仓，查看成本、市值、盈亏与板块分布。",
      },
      { property: "og:title", content: "账户与持仓 — Helix Trading" },
      {
        property: "og:description",
        content: "多账户、多市场、多币种持仓管理与板块分布分析。",
      },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">账户与持仓</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            单账户内可同时持有美股 / 港股 /
            加密货币，市值统一折算为账户基准货币。
          </p>
        </div>
        <AccountsSection />
        <HoldingsSection />
      </div>
    </AppShell>
  );
}

function AccountsSection() {
  const { user } = useAuth();
  const { accounts, activeAccountId, setActiveAccountId, refetch } =
    useAccounts();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [broker, setBroker] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .insert({
          user_id: user!.id,
          name,
          broker: broker || null,
          base_currency: currency,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("账户已创建");
      setOpen(false);
      setName("");
      setBroker("");
      setNotes("");
      refetch();
      setActiveAccountId(data.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "创建失败"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("账户已删除");
      refetch();
    },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">账户列表</CardTitle>
          <CardDescription className="text-xs">
            切换账户后，简报与总览会跟随当前账户
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-1 size-3.5" />
              新建账户
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建账户</DialogTitle>
              <DialogDescription className="text-xs">
                账户基准货币用于统一折算多市场市值。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">账户名称</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="主账户 / 长线仓"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">券商 / 平台</Label>
                  <Input
                    value={broker}
                    onChange={(e) => setBroker(e.target.value)}
                    placeholder="IBKR / 富途 / Binance"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">基准货币</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">备注（策略定位、行业偏好）</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <Button
                className="w-full"
                disabled={!name || create.isPending}
                onClick={() => create.mutate()}
              >
                创建
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            还没有账户，先创建一个吧。
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => setActiveAccountId(a.id)}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  a.id === activeAccountId
                    ? "border-primary/60 bg-secondary"
                    : "border-border hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{a.name}</span>
                  <Badge variant="outline" className="tabular text-[10px]">
                    {a.base_currency}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.broker || "未填写券商"}
                </p>
                {a.notes ? (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                    {a.notes}
                  </p>
                ) : null}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`删除账户「${a.name}」及其持仓记录？`))
                      remove.mutate(a.id);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-bear"
                >
                  <Trash2 className="size-3" /> 删除
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HoldingsSection() {
  const { user } = useAuth();
  const { activeAccount, activeAccountId } = useAccounts();
  const qc = useQueryClient();
  const quotesFn = useServerFn(getQuotes);
  const fileRef = useRef<HTMLInputElement>(null);

  const holdingsQuery = useQuery({
    queryKey: ["holdings", activeAccountId],
    enabled: !!activeAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holdings")
        .select("*")
        .eq("account_id", activeAccountId!);
      if (error) throw error;
      return data as Holding[];
    },
  });

  const holdings = holdingsQuery.data ?? [];

  const quotesQuery = useQuery({
    queryKey: [
      "quotes",
      holdings
        .map((h) => `${h.symbol}:${h.market}`)
        .sort()
        .join(","),
    ],
    enabled: holdings.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () =>
      await quotesFn({
        data: {
          items: holdings.map((h) => ({ symbol: h.symbol, market: h.market })),
        },
      }),
  });

  const summary = useMemo(
    () =>
      buildPortfolio(
        holdings,
        quotesQuery.data ?? {},
        activeAccount?.base_currency ?? "USD",
      ),
    [holdings, quotesQuery.data, activeAccount?.base_currency],
  );

  const base = activeAccount?.base_currency ?? "USD";

  const addHolding = useMutation({
    mutationFn: async (row: Partial<Holding>) => {
      const { error } = await supabase.from("holdings").insert({
        user_id: user!.id,
        account_id: activeAccountId!,
        symbol: row.symbol!.toUpperCase(),
        display_name: row.display_name || null,
        market: row.market ?? "US",
        currency: row.currency ?? "USD",
        quantity: row.quantity ?? 0,
        avg_cost: row.avg_cost ?? 0,
        sector: row.sector || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("持仓已添加");
      qc.invalidateQueries({ queryKey: ["holdings", activeAccountId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "添加失败"),
  });

  const removeHolding = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holdings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["holdings", activeAccountId] }),
  });

  const importCsv = async (file: File) => {
    const text = await file.text();
    const { rows, errors } = parseHoldingsCsv(text);
    if (errors.length) errors.slice(0, 4).forEach((e) => toast.warning(e));
    if (rows.length === 0) {
      toast.error("没有可导入的行");
      return;
    }
    const { error } = await supabase.from("holdings").insert(
      rows.map((r) => ({
        user_id: user!.id,
        account_id: activeAccountId!,
        symbol: r.symbol,
        display_name: r.display_name || null,
        market: r.market,
        currency: r.currency,
        quantity: r.quantity,
        avg_cost: r.avg_cost,
        sector: r.sector || null,
      })),
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`已导入 ${rows.length} 条持仓`);
    qc.invalidateQueries({ queryKey: ["holdings", activeAccountId] });
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "helix-holdings-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!activeAccountId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          请选择或创建一个账户后录入持仓。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="总市值" value={fmtMoney(summary.totalValue, base)} />
        <StatCard label="总成本" value={fmtMoney(summary.totalCost, base)} />
        <StatCard
          label="浮动盈亏"
          value={fmtMoney(summary.totalPnl, base)}
          tone={summary.totalPnl}
        />
        <StatCard
          label="盈亏比例"
          value={fmtPct(summary.totalPnlPct)}
          tone={summary.totalPnlPct}
        />
      </div>

      {summary.unpriced > 0 ? (
        <p className="text-xs text-warn">
          {summary.unpriced}{" "}
          个标的行情不可用（代码可能有误或数据源不覆盖），其市值按 0 计入。
        </p>
      ) : null}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">持仓明细</CardTitle>
            <CardDescription className="text-xs">
              行情来自多源免费数据（延迟），汇率为静态默认值
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={downloadTemplate}>
              <Download className="mr-1 size-3.5" />
              CSV 模板
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-1 size-3.5" />
              导入 CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importCsv(f);
                e.target.value = "";
              }}
            />
            <AddHoldingDialog onSubmit={(row) => addHolding.mutate(row)} />
          </div>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              暂无持仓。可手动添加，或用 CSV 模板批量导入。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>标的</TableHead>
                    <TableHead>市场</TableHead>
                    <TableHead className="text-right">数量</TableHead>
                    <TableHead className="text-right">成本</TableHead>
                    <TableHead className="text-right">现价</TableHead>
                    <TableHead className="text-right">日涨跌</TableHead>
                    <TableHead className="text-right">市值({base})</TableHead>
                    <TableHead className="text-right">盈亏</TableHead>
                    <TableHead className="text-right">权重</TableHead>
                    <TableHead>板块</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div className="tabular">{r.symbol}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.display_name || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {MARKETS.find((m) => m.value === r.market)?.label ??
                          r.market}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {fmtNum(r.quantity, 4)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {fmtNum(r.avg_cost)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {fmtNum(r.price)}
                      </TableCell>
                      <TableCell
                        className={`tabular text-right ${toneClass(r.changePct)}`}
                      >
                        {fmtPct(r.changePct)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {fmtMoney(r.marketValue, base)}
                      </TableCell>
                      <TableCell
                        className={`tabular text-right ${toneClass(r.pnl)}`}
                      >
                        {fmtMoney(r.pnl, base)}
                        <div className="text-[11px]">{fmtPct(r.pnlPct)}</div>
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {fmtPct(r.weightPct, 1)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.sector || "未标注"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeHolding.mutate(r.id)}
                          aria-label="删除持仓"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {holdings.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <DistributionCard
            title="板块分布"
            items={summary.sectors}
            base={base}
          />
          <DistributionCard
            title="市场分布"
            items={summary.markets}
            base={base}
          />
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`tabular mt-1 text-lg font-semibold ${tone != null ? toneClass(tone) : ""}`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function DistributionCard({
  title,
  items,
  base,
}: {
  title: string;
  items: { name: string; value: number; pct: number }[];
  base: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {items.map((s) => (
          <div key={s.name}>
            <div className="flex items-center justify-between text-xs">
              <span>{s.name}</span>
              <span className="tabular text-muted-foreground">
                {fmtMoney(s.value, base)} · {s.pct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${s.pct}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AddHoldingDialog({
  onSubmit,
}: {
  onSubmit: (row: Partial<Holding>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [market, setMarket] = useState("US");
  const [currency, setCurrency] = useState("USD");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [sector, setSector] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 size-3.5" />
          添加持仓
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加持仓</DialogTitle>
          <DialogDescription className="text-xs">
            港股填 4 位代码或 0700.HK；加密填 BTC / ETH。
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">代码</Label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="AAPL"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Apple"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">市场</Label>
            <Select
              value={market}
              onValueChange={(v) => {
                setMarket(v);
                setCurrency(
                  MARKETS.find((m) => m.value === v)?.currency ?? "USD",
                );
              }}
            >
              <SelectTrigger>
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
          <div className="space-y-1.5">
            <Label className="text-xs">币种</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">数量</Label>
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
              placeholder="100"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">平均成本</Label>
            <Input
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              inputMode="decimal"
              placeholder="182.35"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">板块 / 行业标签</Label>
            <Input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="信息技术"
            />
          </div>
        </div>
        <Button
          className="w-full"
          disabled={!symbol || !quantity || !cost}
          onClick={() => {
            onSubmit({
              symbol,
              display_name: name,
              market,
              currency,
              quantity: Number(quantity),
              avg_cost: Number(cost),
              sector,
            });
            setOpen(false);
            setSymbol("");
            setName("");
            setQuantity("");
            setCost("");
            setSector("");
          }}
        >
          添加
        </Button>
      </DialogContent>
    </Dialog>
  );
}
