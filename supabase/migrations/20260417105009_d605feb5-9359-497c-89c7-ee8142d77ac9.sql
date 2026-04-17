-- Messages from public users to admin
CREATE TABLE public.admin_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('download_request', 'feature_request')),
  campaign_id UUID NULL REFERENCES public.campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  handled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_messages_created_at ON public.admin_messages (created_at DESC);
CREATE INDEX idx_admin_messages_kind_handled ON public.admin_messages (kind, handled);

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a message (server function rate-limits)
CREATE POLICY "Anyone can submit admin message"
ON public.admin_messages FOR INSERT
TO public
WITH CHECK (true);

-- No public SELECT/UPDATE/DELETE: only the admin server functions (service role) read/modify these.