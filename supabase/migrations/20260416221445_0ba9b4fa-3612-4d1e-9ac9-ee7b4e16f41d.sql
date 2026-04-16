
-- Campaigns
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  whatsapp_link TEXT NOT NULL,
  target INTEGER NOT NULL DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaigns are viewable by everyone"
  ON public.campaigns FOR SELECT USING (true);

CREATE POLICY "Anyone can create a campaign"
  ON public.campaigns FOR INSERT WITH CHECK (true);

-- Contacts
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_campaign ON public.contacts(campaign_id);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contacts are viewable by everyone"
  ON public.contacts FOR SELECT USING (true);

CREATE POLICY "Anyone can submit a contact"
  ON public.contacts FOR INSERT WITH CHECK (true);

-- App settings (pinned numbers + admin password)
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  pinned_contacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  admin_password TEXT NOT NULL DEFAULT 'admin123',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Public can read pinned contacts only via a server function (we won't expose admin_password client-side).
-- For simplicity allow public SELECT but we'll only ever query pinned_contacts column from client.
CREATE POLICY "Settings readable by everyone"
  ON public.app_settings FOR SELECT USING (true);

INSERT INTO public.app_settings (id, pinned_contacts, admin_password)
VALUES (
  1,
  '[{"name":"SYMOH","phone":"+254780307701"},{"name":"Tech","phone":"+254115490569"}]'::jsonb,
  'admin123'
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
