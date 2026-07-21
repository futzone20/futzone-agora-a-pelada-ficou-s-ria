ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cadastro_completo BOOLEAN NOT NULL DEFAULT true;