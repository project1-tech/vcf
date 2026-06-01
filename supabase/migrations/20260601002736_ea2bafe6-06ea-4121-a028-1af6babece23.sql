ALTER TABLE public.campaigns ADD COLUMN download_expires_at timestamptz;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER TABLE public.campaigns REPLICA IDENTITY FULL;