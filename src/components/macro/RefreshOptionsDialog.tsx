import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCY_OPTIONS, useBaseCurrency, type BaseCurrency } from "@/lib/base-currency";
import { TIMEZONE_OPTIONS, offsetLabel } from "@/lib/time-format";
import { useTimezone } from "@/lib/timezone";

type Props = {
  onConfirm: () => void;
  refreshing?: boolean | undefined;
};

/** 刷新前确认：本次简报按哪个时区显示、以哪个币种作为阅读基准。 */
export function RefreshOptionsDialog({ onConfirm, refreshing }: Props) {
  const [open, setOpen] = useState(false);
  const { auto, tz, setTz } = useTimezone();
  const { currency, setCurrency } = useBaseCurrency();
  const tzValue = auto ? "auto" : tz;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={refreshing} aria-label="刷新简报">
          <RefreshCw className={`mr-1 size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>刷新简报</DialogTitle>
          <DialogDescription>
            确认本次简报的显示时区与阅读基准币种，确认后重新取数。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">显示时区</p>
            <Select value={tzValue} onValueChange={setTz}>
              <SelectTrigger className="h-9 text-sm" aria-label="选择显示时区">
                <SelectValue placeholder="选择时区" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">自动识别（{offsetLabel(tz)}）</SelectItem>
                {TIMEZONE_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}（{offsetLabel(o.id)}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">基准币种</p>
            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as BaseCurrency)}
            >
              <SelectTrigger className="h-9 text-sm" aria-label="选择基准币种">
                <SelectValue placeholder="选择币种" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            基准币种只用于标注价格的计价单位，不做汇率换算，数值仍为数据源原值（恒生指数为
            HKD 点位，黄金 / 原油为 USD 计价）。
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            确认并刷新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
