import { Globe } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMEZONE_OPTIONS, offsetLabel } from "@/lib/time-format";
import { useTimezone } from "@/lib/timezone";

/** 时区选择器：默认自动识别浏览器时区，选择后本地保存。 */
export function TimezoneSelect() {
  const { auto, tz, setTz } = useTimezone();
  const value = auto ? "auto" : tz;

  return (
    <label className="flex shrink-0 items-center gap-1.5">
      <Globe aria-hidden className="size-3.5 text-muted-foreground" />
      <span className="sr-only">选择你所在的时区</span>
      <Select value={value} onValueChange={setTz}>
        <SelectTrigger className="h-8 w-[168px] text-xs" aria-label="选择你所在的时区">
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
    </label>
  );
}
