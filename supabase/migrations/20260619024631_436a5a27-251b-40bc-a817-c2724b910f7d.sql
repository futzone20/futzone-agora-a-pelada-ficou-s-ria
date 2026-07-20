
-- pelada_confirmacoes: drop existing policies
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename='pelada_confirmacoes' AND schemaname='public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pelada_confirmacoes', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "jogador confirma presenca"
ON public.pelada_confirmacoes FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.peladas p
    JOIN public.grupo_membros gm ON gm.grupo_id = p.grupo_id
    WHERE p.id = pelada_confirmacoes.pelada_id
      AND gm.user_id = auth.uid()
      AND gm.papel IN ('capitao','auxiliar')
      AND gm.status = 'ativo'
  )
);

CREATE POLICY "capitao gerencia confirmacoes"
ON public.pelada_confirmacoes FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.peladas p
    JOIN public.grupo_membros gm ON gm.grupo_id = p.grupo_id
    WHERE p.id = pelada_confirmacoes.pelada_id
      AND gm.user_id = auth.uid()
      AND gm.papel IN ('capitao','auxiliar')
      AND gm.status = 'ativo'
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.peladas p
    JOIN public.grupo_membros gm ON gm.grupo_id = p.grupo_id
    WHERE p.id = pelada_confirmacoes.pelada_id
      AND gm.user_id = auth.uid()
      AND gm.papel IN ('capitao','auxiliar')
      AND gm.status = 'ativo'
  )
);

CREATE POLICY "membros veem confirmacoes"
ON public.pelada_confirmacoes FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.peladas p
    JOIN public.grupo_membros gm ON gm.grupo_id = p.grupo_id
    WHERE p.id = pelada_confirmacoes.pelada_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'ativo'
  )
);

CREATE POLICY "jogador atualiza propria confirmacao"
ON public.pelada_confirmacoes FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
