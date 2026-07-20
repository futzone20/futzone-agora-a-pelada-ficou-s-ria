DROP POLICY IF EXISTS "capitao insere partidas" ON public.partidas;
DROP POLICY IF EXISTS "capitao edita partidas" ON public.partidas;
DROP POLICY IF EXISTS "capitao remove partidas" ON public.partidas;
DROP POLICY IF EXISTS "capitao cria partidas" ON public.partidas;
DROP POLICY IF EXISTS "publico ve partidas" ON public.partidas;
DROP POLICY IF EXISTS "acesso partidas" ON public.partidas;
DROP POLICY IF EXISTS "partidas_all_capitao" ON public.partidas;
DROP POLICY IF EXISTS "partidas_select_membros" ON public.partidas;
DROP POLICY IF EXISTS "partidas_select_publico" ON public.partidas;

CREATE POLICY "partidas_all_capitao"
ON public.partidas FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.peladas p
    JOIN public.grupo_membros gm ON gm.grupo_id = p.grupo_id
    WHERE p.id = partidas.pelada_id
      AND gm.user_id = auth.uid()
      AND gm.papel IN ('capitao','auxiliar')
      AND gm.status = 'ativo'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.peladas p
    JOIN public.grupo_membros gm ON gm.grupo_id = p.grupo_id
    WHERE p.id = partidas.pelada_id
      AND gm.user_id = auth.uid()
      AND gm.papel IN ('capitao','auxiliar')
      AND gm.status = 'ativo'
  )
);

CREATE POLICY "partidas_select_membros"
ON public.partidas FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.peladas p
    JOIN public.grupo_membros gm ON gm.grupo_id = p.grupo_id
    WHERE p.id = partidas.pelada_id
      AND gm.user_id = auth.uid()
      AND gm.status = 'ativo'
  )
);

CREATE POLICY "partidas_select_publico"
ON public.partidas FOR SELECT
TO anon
USING (true);