
DROP POLICY IF EXISTS "sistema insere auditoria" ON public.lances_auditoria;
CREATE POLICY "usuario insere auditoria propria" ON public.lances_auditoria
  FOR INSERT TO authenticated WITH CHECK (feito_por = auth.uid());
