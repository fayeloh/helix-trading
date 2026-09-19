CREATE TABLE public.event_impacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  source_briefing_id uuid REFERENCES public.briefings(id) ON DELETE SET NULL,
  event_kind text NOT NULL DEFAULT 'headline',
  title text NOT NULL,
  published_at text,
  source text,
  direction text NOT NULL DEFAULT 'unknown',
  impact_targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  symbols text[] NOT NULL DEFAULT '{}'::text[],
  baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_impacts TO authenticated;
GRANT ALL ON public.event_impacts TO service_role;

ALTER TABLE public.event_impacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_impacts_own ON public.event_impacts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER event_impacts_updated_at BEFORE UPDATE ON public.event_impacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX event_impacts_user_recorded_idx ON public.event_impacts (user_id, recorded_at DESC);