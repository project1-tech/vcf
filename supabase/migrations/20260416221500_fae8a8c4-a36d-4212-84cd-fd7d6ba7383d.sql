
DROP POLICY "Settings readable by everyone" ON public.app_settings;

CREATE OR REPLACE FUNCTION public.get_pinned_contacts()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pinned_contacts FROM public.app_settings WHERE id = 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_pinned_contacts() TO anon, authenticated;
