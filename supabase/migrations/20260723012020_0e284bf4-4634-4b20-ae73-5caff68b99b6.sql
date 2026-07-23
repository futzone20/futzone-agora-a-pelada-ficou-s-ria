ALTER TYPE public.status_membro ADD VALUE IF NOT EXISTS 'pendente';

ALTER TABLE public.peladas
  ADD COLUMN IF NOT EXISTS token_confirmacao TEXT UNIQUE DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  ADD COLUMN IF NOT EXISTS horario_abertura_lista TIME NOT NULL DEFAULT '09:00';

UPDATE public.peladas SET token_confirmacao = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) WHERE token_confirmacao IS NULL;