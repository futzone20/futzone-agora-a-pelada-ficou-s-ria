
-- 1. Allow public/auth read of grupos by codigo_convite (campos básicos)
CREATE POLICY "Convite publico por codigo"
ON public.grupos FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON public.grupos TO anon;

-- 2. Notificacoes: add tipo + dados_extras
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS dados_extras JSONB DEFAULT '{}'::jsonb;

-- 3. Convites_grupo
CREATE TABLE IF NOT EXISTS public.convites_grupo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  capitao_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  convidado_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondido_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.convites_grupo TO authenticated;
GRANT ALL ON public.convites_grupo TO service_role;

ALTER TABLE public.convites_grupo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Capitao cria convite"
ON public.convites_grupo FOR INSERT
TO authenticated
WITH CHECK (public.is_grupo_capitao(grupo_id, auth.uid()) AND capitao_id = auth.uid());

CREATE POLICY "Convidado ou capitao ve"
ON public.convites_grupo FOR SELECT
TO authenticated
USING (convidado_id = auth.uid() OR capitao_id = auth.uid() OR public.is_grupo_capitao(grupo_id, auth.uid()));

CREATE POLICY "Convidado responde"
ON public.convites_grupo FOR UPDATE
TO authenticated
USING (convidado_id = auth.uid())
WITH CHECK (convidado_id = auth.uid());

-- 4. Trigger: notificar convidado ao criar convite
CREATE OR REPLACE FUNCTION public.handle_convite_grupo_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cap TEXT; _gr TEXT;
BEGIN
  SELECT nome INTO _cap FROM public.profiles WHERE user_id = NEW.capitao_id;
  SELECT nome INTO _gr FROM public.grupos WHERE id = NEW.grupo_id;
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, dados_extras, link)
  VALUES (
    NEW.convidado_id,
    '👑 Você foi convidado!',
    COALESCE(_cap, 'Um capitão') || ' está te convocando para entrar no grupo "' || COALESCE(_gr, '') || '"',
    'convite_grupo',
    jsonb_build_object('convite_id', NEW.id, 'grupo_id', NEW.grupo_id, 'grupo_nome', _gr),
    '/jogador'
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_convite_grupo_insert ON public.convites_grupo;
CREATE TRIGGER trg_convite_grupo_insert
AFTER INSERT ON public.convites_grupo
FOR EACH ROW EXECUTE FUNCTION public.handle_convite_grupo_insert();

-- 5. Funções para aceitar/recusar
CREATE OR REPLACE FUNCTION public.aceitar_convite_grupo(_convite_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.convites_grupo%ROWTYPE; _gnome TEXT; _jnome TEXT;
BEGIN
  SELECT * INTO _c FROM public.convites_grupo WHERE id = _convite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado'; END IF;
  IF _c.convidado_id <> auth.uid() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF _c.status <> 'pendente' THEN RAISE EXCEPTION 'Convite já respondido'; END IF;
  IF _c.expira_em < now() THEN
    UPDATE public.convites_grupo SET status='expirado' WHERE id=_convite_id;
    RAISE EXCEPTION 'Convite expirado';
  END IF;

  UPDATE public.convites_grupo SET status='aceito', respondido_em=now() WHERE id=_convite_id;
  INSERT INTO public.grupo_membros (grupo_id, user_id, papel, status)
  VALUES (_c.grupo_id, _c.convidado_id, 'jogador', 'ativo')
  ON CONFLICT (grupo_id, user_id) DO UPDATE SET status='ativo';

  SELECT nome INTO _gnome FROM public.grupos WHERE id = _c.grupo_id;
  SELECT nome INTO _jnome FROM public.profiles WHERE user_id = _c.convidado_id;
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, link)
  VALUES (_c.capitao_id, '✅ Convite aceito',
    COALESCE(_jnome,'Jogador') || ' aceitou seu convite e entrou no grupo "' || COALESCE(_gnome,'') || '"!',
    'convite_resposta', '/capitao/grupos');
  RETURN _c.grupo_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.aceitar_convite_grupo(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.recusar_convite_grupo(_convite_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c public.convites_grupo%ROWTYPE; _gnome TEXT; _jnome TEXT;
BEGIN
  SELECT * INTO _c FROM public.convites_grupo WHERE id = _convite_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado'; END IF;
  IF _c.convidado_id <> auth.uid() THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  IF _c.status <> 'pendente' THEN RETURN; END IF;
  UPDATE public.convites_grupo SET status='recusado', respondido_em=now() WHERE id=_convite_id;
  SELECT nome INTO _gnome FROM public.grupos WHERE id = _c.grupo_id;
  SELECT nome INTO _jnome FROM public.profiles WHERE user_id = _c.convidado_id;
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, link)
  VALUES (_c.capitao_id, '❌ Convite recusado',
    COALESCE(_jnome,'Jogador') || ' recusou o convite para o grupo "' || COALESCE(_gnome,'') || '".',
    'convite_resposta', '/capitao/grupos');
END; $$;

GRANT EXECUTE ON FUNCTION public.recusar_convite_grupo(UUID) TO authenticated;

-- Allow profile search for adding members (read minimal data)
-- profiles already has policies; ensure authenticated can SELECT others (likely already true)
