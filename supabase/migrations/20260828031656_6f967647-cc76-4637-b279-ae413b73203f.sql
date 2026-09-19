DROP POLICY IF EXISTS "market_cache_read" ON public.market_cache;
REVOKE ALL ON public.market_cache FROM anon;
REVOKE ALL ON public.market_cache FROM authenticated;
GRANT ALL ON public.market_cache TO service_role;