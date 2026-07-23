
CREATE TABLE IF NOT EXISTS public.vaquinhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor_sugerido NUMERIC,
  criado_por UUID NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ativa'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaquinhas TO authenticated;
GRANT ALL ON public.vaquinhas TO service_role;
ALTER TABLE public.vaquinhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem vaquinhas" ON public.vaquinhas FOR SELECT TO authenticated
  USING (public.is_grupo_member(grupo_id, auth.uid()));
CREATE POLICY "Capitao cria vaquinhas" ON public.vaquinhas FOR INSERT TO authenticated
  WITH CHECK (public.is_grupo_capitao(grupo_id, auth.uid()));
CREATE POLICY "Capitao edita vaquinhas" ON public.vaquinhas FOR UPDATE TO authenticated
  USING (public.is_grupo_capitao(grupo_id, auth.uid()));
CREATE POLICY "Capitao exclui vaquinhas" ON public.vaquinhas FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.grupo_membros gm
    WHERE gm.grupo_id = vaquinhas.grupo_id AND gm.user_id = auth.uid()
      AND gm.status = 'ativo' AND gm.papel = 'capitao'
  ));

CREATE TABLE IF NOT EXISTS public.vaquinha_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaquinha_id UUID NOT NULL REFERENCES public.vaquinhas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  pagamento_status TEXT NOT NULL DEFAULT 'nao_pago',
  forma_pagamento TEXT,
  informado_em TIMESTAMPTZ,
  confirmado_em TIMESTAMPTZ,
  UNIQUE(vaquinha_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaquinha_participantes TO authenticated;
GRANT ALL ON public.vaquinha_participantes TO service_role;
ALTER TABLE public.vaquinha_participantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participante ou capitao ve" ON public.vaquinha_participantes FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.vaquinhas v WHERE v.id = vaquinha_participantes.vaquinha_id AND public.is_grupo_capitao(v.grupo_id, auth.uid()))
  );
CREATE POLICY "Capitao cria participantes" ON public.vaquinha_participantes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.vaquinhas v WHERE v.id = vaquinha_participantes.vaquinha_id AND public.is_grupo_capitao(v.grupo_id, auth.uid()))
  );
CREATE POLICY "Participante ou capitao atualiza" ON public.vaquinha_participantes FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.vaquinhas v WHERE v.id = vaquinha_participantes.vaquinha_id AND public.is_grupo_capitao(v.grupo_id, auth.uid()))
  );
