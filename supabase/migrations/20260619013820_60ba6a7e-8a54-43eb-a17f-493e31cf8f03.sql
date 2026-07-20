
ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS origem_ultima_atualizacao text,
  ADD COLUMN IF NOT EXISTS total_avaliacoes_recebidas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS peso_capitao_atual numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

-- Captain can read & manage skills of members of any group they captain
DROP POLICY IF EXISTS "Capitao ve skills de membros" ON public.skills;
CREATE POLICY "Capitao ve skills de membros"
ON public.skills FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.grupo_membros gm_self
    JOIN public.grupo_membros gm_target
      ON gm_target.grupo_id = gm_self.grupo_id
    WHERE gm_self.user_id = auth.uid()
      AND gm_self.papel IN ('capitao','auxiliar')
      AND gm_self.status = 'ativo'
      AND gm_target.user_id = public.skills.user_id
      AND gm_target.status = 'ativo'
  )
);

DROP POLICY IF EXISTS "Capitao edita skills de membros" ON public.skills;
CREATE POLICY "Capitao edita skills de membros"
ON public.skills FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.grupo_membros gm_self
    JOIN public.grupo_membros gm_target
      ON gm_target.grupo_id = gm_self.grupo_id
    WHERE gm_self.user_id = auth.uid()
      AND gm_self.papel IN ('capitao','auxiliar')
      AND gm_self.status = 'ativo'
      AND gm_target.user_id = public.skills.user_id
      AND gm_target.status = 'ativo'
  )
) WITH CHECK (true);

DROP POLICY IF EXISTS "Capitao insere skills de membros" ON public.skills;
CREATE POLICY "Capitao insere skills de membros"
ON public.skills FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.grupo_membros gm_self
    JOIN public.grupo_membros gm_target
      ON gm_target.grupo_id = gm_self.grupo_id
    WHERE gm_self.user_id = auth.uid()
      AND gm_self.papel IN ('capitao','auxiliar')
      AND gm_self.status = 'ativo'
      AND gm_target.user_id = public.skills.user_id
      AND gm_target.status = 'ativo'
  )
);
