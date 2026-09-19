import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CandlestickChart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DisclaimerBanner } from "@/components/Disclaimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "登录 — Helix Trading 交易决策辅助" },
      {
        name: "description",
        content: "登录 Helix Trading，管理你的多市场账户持仓、每日简报与交易纪律记录。",
      },
      { property: "og:title", content: "登录 — Helix Trading" },
      { property: "og:description", content: "管理多市场持仓、每日简报与交易纪律记录。" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("注册成功，正在进入…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast.error("Google 登录失败，请改用邮箱登录");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded bg-primary text-primary-foreground">
            <CandlestickChart className="size-4" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Helix Trading</h1>
            <p className="text-xs text-muted-foreground">
              结构化依据 · 事件日历 · 交易纪律
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {mode === "signin" ? "登录账户" : "创建账户"}
            </CardTitle>
            <CardDescription className="text-xs">
              数据仅你本人可见，采用行级权限隔离。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList className="w-full">
                <TabsTrigger value="signin" className="flex-1 text-xs">
                  登录
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1 text-xs">
                  注册
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">
                  邮箱
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">
                  密码
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {mode === "signin" ? "登录" : "注册并进入"}
              </Button>
            </form>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />或<span className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" className="w-full" onClick={google} disabled={busy}>
              使用 Google 登录
            </Button>
          </CardContent>
        </Card>

        <DisclaimerBanner />
      </div>
    </div>
  );
}
