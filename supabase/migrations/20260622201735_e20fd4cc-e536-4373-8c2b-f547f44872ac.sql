REVOKE EXECUTE ON FUNCTION public.verify_sub_admin(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_sub_admin(text, text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_sub_admin(uuid, text, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_sub_admin(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_sub_admin(text, text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_sub_admin(uuid, text, text[]) TO service_role;