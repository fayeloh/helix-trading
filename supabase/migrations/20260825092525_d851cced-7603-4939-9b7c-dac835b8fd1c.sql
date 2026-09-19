ALTER TABLE public.research_reports ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'zh';
ALTER TABLE public.briefings ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'zh';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lang text NOT NULL DEFAULT 'zh';