-- pgcrypto already installed in extensions schema; reference fully-qualified.

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$')
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ADMIN_MESSAGES extensions ============
ALTER TABLE public.admin_messages
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN admin_reply text,
  ADD COLUMN replied_at timestamptz,
  ADD COLUMN read_by_user_at timestamptz;

GRANT SELECT, UPDATE ON public.admin_messages TO authenticated;

CREATE POLICY "Users can view own messages"
  ON public.admin_messages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own replies read"
  ON public.admin_messages FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can submit admin message" ON public.admin_messages;
CREATE POLICY "Authenticated users can submit messages"
  ON public.admin_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============ SUB_ADMINS ============
CREATE TABLE public.sub_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sub_admin_username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$')
);

GRANT ALL ON public.sub_admins TO service_role;

ALTER TABLE public.sub_admins ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER sub_admins_updated_at
  BEFORE UPDATE ON public.sub_admins
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.verify_sub_admin(_username text, _password text)
RETURNS TABLE(id uuid, username text, permissions text[])
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions AS $$
  SELECT s.id, s.username, s.permissions
  FROM public.sub_admins s
  WHERE s.username = _username
    AND s.password_hash = extensions.crypt(_password, s.password_hash);
$$;

CREATE OR REPLACE FUNCTION public.create_sub_admin(
  _username text, _password text, _permissions text[]
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.sub_admins (username, password_hash, permissions)
  VALUES (_username, extensions.crypt(_password, extensions.gen_salt('bf', 10)), _permissions)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sub_admin(
  _id uuid, _password text, _permissions text[]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
BEGIN
  IF _password IS NOT NULL AND length(_password) > 0 THEN
    UPDATE public.sub_admins
      SET password_hash = extensions.crypt(_password, extensions.gen_salt('bf', 10)),
          permissions = _permissions
      WHERE id = _id;
  ELSE
    UPDATE public.sub_admins SET permissions = _permissions WHERE id = _id;
  END IF;
END;
$$;

ALTER TABLE public.admin_messages REPLICA IDENTITY FULL;