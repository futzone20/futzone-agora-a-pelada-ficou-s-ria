
-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('jogador', 'capitao', 'dono_quadra', 'parceiro', 'admin');

-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  data_nascimento DATE,
  role public.app_role NOT NULL DEFAULT 'jogador',
  quer_ser_goleiro BOOLEAN NOT NULL DEFAULT false,
  posicao_preferida TEXT,
  foto_url TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- has_role helper (security definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile EXCEPT role (role changes need admin)
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- skills
CREATE TABLE public.skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  velocidade SMALLINT NOT NULL DEFAULT 3 CHECK (velocidade BETWEEN 1 AND 5),
  drible SMALLINT NOT NULL DEFAULT 3 CHECK (drible BETWEEN 1 AND 5),
  passe SMALLINT NOT NULL DEFAULT 3 CHECK (passe BETWEEN 1 AND 5),
  chute SMALLINT NOT NULL DEFAULT 3 CHECK (chute BETWEEN 1 AND 5),
  resistencia SMALLINT NOT NULL DEFAULT 3 CHECK (resistencia BETWEEN 1 AND 5),
  posicionamento SMALLINT NOT NULL DEFAULT 3 CHECK (posicionamento BETWEEN 1 AND 5)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own skills"
  ON public.skills FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users manage their own skills"
  ON public.skills FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger: cria profile + skills automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role public.app_role;
BEGIN
  BEGIN
    _role := COALESCE(NEW.raw_user_meta_data->>'role', 'jogador')::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    _role := 'jogador';
  END;

  -- Bloqueia signup público como admin
  IF _role = 'admin' THEN
    _role := 'jogador';
  END IF;

  INSERT INTO public.profiles (user_id, nome, email, whatsapp, data_nascimento, role, quer_ser_goleiro)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
    NULLIF(NEW.raw_user_meta_data->>'data_nascimento', '')::date,
    _role,
    COALESCE((NEW.raw_user_meta_data->>'quer_ser_goleiro')::boolean, false)
  );

  INSERT INTO public.skills (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
