CREATE UNIQUE INDEX IF NOT EXISTS contacts_campaign_phone_unique ON public.contacts (campaign_id, phone);

UPDATE public.app_settings SET admin_password = 'Tech11', updated_at = now() WHERE id = 1;