import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { CandlestickChart, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { DisclaimerBanner } from "@/components/Disclaimer";
import { NAV, isNavActive } from "@/components/nav-items";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/lib/i18n";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useLang();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("shell.verifying")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="scanline sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex min-h-[52px] max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-sm bg-primary text-primary-foreground">
              <CandlestickChart className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              Helix Trading
              <span className="micro-label ml-2 rounded-sm border border-border px-1.5 py-0.5">
                {t("app.tagline")}
              </span>
            </span>
          </Link>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {NAV.map((item) => {
              const active = isNavActive(item.to, pathname);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors ${
                    active
                      ? "text-foreground after:absolute after:inset-x-1.5 after:-bottom-[7px] after:h-[2px] after:bg-primary"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  <item.icon
                    className={`size-3.5 ${active ? "text-primary" : ""}`}
                  />
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LangSwitcher />
            <Button
              variant="ghost"
              size="icon"
              className="size-[30px] text-muted-foreground hover:text-primary"
              onClick={() => signOut()}
              aria-label={t("shell.signOut")}
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">{children}</main>

      <footer className="mx-auto max-w-[1400px] px-4 pb-10">
        <DisclaimerBanner />
      </footer>
    </div>
  );
}

function LangSwitcher() {
  const { lang, setLang, t } = useLang();
  return (
    <div
      className="flex h-[30px] items-center rounded-sm border border-border p-0.5"
      role="group"
      aria-label={t("lang.label")}
    >
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          className={`rounded-sm px-2 py-0.5 text-[11px] font-medium transition-colors ${
            lang === l
              ? "bg-primary-muted text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l === "zh" ? "中文" : "EN"}
        </button>
      ))}
    </div>
  );
}
