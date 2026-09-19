CREATE TABLE public.watchlist_indexes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  label text NOT NULL,
  "group" text NOT NULL DEFAULT '股指',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watchlist_indexes TO authenticated;
GRANT ALL ON public.watchlist_indexes TO service_role;

ALTER TABLE public.watchlist_indexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY watchlist_indexes_own ON public.watchlist_indexes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());