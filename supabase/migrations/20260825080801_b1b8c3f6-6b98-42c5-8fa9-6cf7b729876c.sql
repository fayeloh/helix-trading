-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  display_timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  broker TEXT,
  base_currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_own" ON public.accounts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX accounts_user_idx ON public.accounts(user_id);
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- holdings
CREATE TABLE public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  display_name TEXT,
  market TEXT NOT NULL DEFAULT 'US',
  currency TEXT NOT NULL DEFAULT 'USD',
  quantity NUMERIC NOT NULL DEFAULT 0,
  avg_cost NUMERIC NOT NULL DEFAULT 0,
  sector TEXT,
  industry_tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holdings TO authenticated;
GRANT ALL ON public.holdings TO service_role;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "holdings_own" ON public.holdings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX holdings_account_idx ON public.holdings(account_id);
CREATE TRIGGER holdings_updated_at BEFORE UPDATE ON public.holdings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- journal entries
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'US',
  direction TEXT NOT NULL DEFAULT 'long',
  status TEXT NOT NULL DEFAULT 'open',
  thesis TEXT,
  entry_reason TEXT,
  exit_reason TEXT,
  planned_stop NUMERIC,
  planned_target NUMERIC,
  max_position_pct NUMERIC,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  emotion TEXT,
  review_notes TEXT,
  outcome_pct NUMERIC,
  discipline_score INTEGER,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journal_own" ON public.journal_entries FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX journal_user_idx ON public.journal_entries(user_id);
CREATE TRIGGER journal_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'US',
  side TEXT NOT NULL DEFAULT 'buy',
  quantity NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  fees NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  trade_date DATE NOT NULL DEFAULT (now()::date),
  reason TEXT,
  emotion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_own" ON public.transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX transactions_account_idx ON public.transactions(account_id);

-- checklist templates
CREATE TABLE public.checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_templates TO authenticated;
GRANT ALL ON public.checklist_templates TO service_role;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_own" ON public.checklist_templates FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER checklist_updated_at BEFORE UPDATE ON public.checklist_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- risk rules
CREATE TABLE public.risk_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  max_position_pct NUMERIC NOT NULL DEFAULT 15,
  max_sector_pct NUMERIC NOT NULL DEFAULT 35,
  default_stop_pct NUMERIC NOT NULL DEFAULT 8,
  max_open_positions INTEGER NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_rules TO authenticated;
GRANT ALL ON public.risk_rules TO service_role;
ALTER TABLE public.risk_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_rules_own" ON public.risk_rules FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER risk_rules_updated_at BEFORE UPDATE ON public.risk_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- briefings
CREATE TABLE public.briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  briefing_type TEXT NOT NULL,
  briefing_date DATE NOT NULL DEFAULT (now()::date),
  holdings_hash TEXT,
  payload JSONB NOT NULL,
  model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefings TO authenticated;
GRANT ALL ON public.briefings TO service_role;
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefings_own" ON public.briefings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX briefings_lookup_idx ON public.briefings(user_id, briefing_type, briefing_date DESC);

-- research reports
CREATE TABLE public.research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'US',
  section TEXT NOT NULL,
  lookback_days INTEGER,
  payload JSONB NOT NULL,
  model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_reports TO authenticated;
GRANT ALL ON public.research_reports TO service_role;
ALTER TABLE public.research_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "research_own" ON public.research_reports FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX research_lookup_idx ON public.research_reports(user_id, symbol, section);

-- shared market data cache (public market data, server-written)
CREATE TABLE public.market_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '15 minutes')
);
GRANT SELECT ON public.market_cache TO authenticated, anon;
GRANT ALL ON public.market_cache TO service_role;
ALTER TABLE public.market_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_cache_read" ON public.market_cache FOR SELECT TO authenticated, anon USING (true);

-- bootstrap new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.checklist_templates (user_id, name, is_default, items)
  VALUES (NEW.id, '默认交易前检查清单', true, '[
    {"id":"thesis","label":"我能用两句话说清买入逻辑（基本面依据）"},
    {"id":"catalyst","label":"我知道未来一个月内的关键事件（财报/宏观数据）"},
    {"id":"stop","label":"我已设定止损位与最大可承受亏损"},
    {"id":"size","label":"仓位不超过单标的上限"},
    {"id":"correlation","label":"该标的与现有持仓不是高度重复的风险暴露"},
    {"id":"emotion","label":"我不是因为FOMO/报复性交易而下单"},
    {"id":"invalidate","label":"我明确知道什么情况会证明逻辑失效并离场"}
  ]'::jsonb);

  INSERT INTO public.risk_rules (user_id) VALUES (NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();