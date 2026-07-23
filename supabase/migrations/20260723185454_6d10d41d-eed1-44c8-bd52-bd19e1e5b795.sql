CREATE TABLE IF NOT EXISTS public.grupo_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  texto TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_por UUID NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupo_regras TO authenticated;
GRANT ALL ON public.grupo_regras TO service_role;
ALTER TABLE public.grupo_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem regras" ON public.grupo_regras FOR SELECT TO authenticated
  USING (public.is_grupo_member(grupo_id, auth.uid()));

CREATE POLICY "Capitao ou auxiliar cria regras" ON public.grupo_regras FOR INSERT TO authenticated
  WITH CHECK (public.is_grupo_capitao(grupo_id, auth.uid()));

CREATE POLICY "Capitao ou auxiliar edita regras" ON public.grupo_regras FOR UPDATE TO authenticated
  USING (public.is_grupo_capitao(grupo_id, auth.uid()));

CREATE POLICY "Capitao exclui regras" ON public.grupo_regras FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.grupo_membros gm
    WHERE gm.grupo_id = grupo_regras.grupo_id AND gm.user_id = auth.uid()
      AND gm.status = 'ativo' AND gm.papel = 'capitao'
  ));