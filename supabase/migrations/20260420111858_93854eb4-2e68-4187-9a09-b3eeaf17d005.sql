-- Announcements table for top-of-site banners
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  link_url TEXT,
  link_label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Anyone can read announcements (public banners)
CREATE POLICY "Announcements are viewable by everyone"
  ON public.announcements FOR SELECT
  USING (true);

-- Validation trigger (avoid CHECK with now())
CREATE OR REPLACE FUNCTION public.validate_announcement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.link_url IS NOT NULL AND NEW.link_url !~* '^https?://' THEN
    RAISE EXCEPTION 'link_url must start with http:// or https://';
  END IF;
  IF length(NEW.message) < 1 OR length(NEW.message) > 500 THEN
    RAISE EXCEPTION 'message must be 1-500 characters';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_announcement_trg
BEFORE INSERT OR UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.validate_announcement();

CREATE INDEX idx_announcements_active_expires ON public.announcements (active, expires_at);