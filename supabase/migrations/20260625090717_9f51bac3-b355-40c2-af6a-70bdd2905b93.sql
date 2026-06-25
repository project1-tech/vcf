
-- Enable Realtime on admin_messages for live admin reply updates
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.admin_messages REPLICA IDENTITY FULL;

-- Audit log for Notify-me / Contact-Admin clicks
CREATE TABLE IF NOT EXISTS public.admin_click_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('contact_admin', 'notify_me')),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  slug text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_click_logs_created_at
  ON public.admin_click_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_click_logs_slug
  ON public.admin_click_logs (slug);

GRANT ALL ON public.admin_click_logs TO service_role;
ALTER TABLE public.admin_click_logs ENABLE ROW LEVEL SECURITY;
-- No public policies: only service_role (server fns) reads/writes.
