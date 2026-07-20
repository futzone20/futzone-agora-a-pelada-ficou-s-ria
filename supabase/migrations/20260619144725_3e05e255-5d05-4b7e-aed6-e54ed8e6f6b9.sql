
ALTER TABLE public.peladas
  ADD COLUMN IF NOT EXISTS tempo_locado_minutos int DEFAULT 60,
  ADD COLUMN IF NOT EXISTS gols_para_encerrar int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS modalidade_goleiro text DEFAULT 'fixo',
  ADD COLUMN IF NOT EXISTS jogadores_linha_por_time int DEFAULT 4,
  ADD COLUMN IF NOT EXISTS aluguel_iniciado_em timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS atraso_registrado_em timestamptz DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.partida_goleiros_fixos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id uuid NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  pelada_id uuid NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  time_id uuid REFERENCES public.times(id) ON DELETE CASCADE,
  goleiro_user_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partida_goleiros_fixos TO authenticated;
GRANT ALL ON public.partida_goleiros_fixos TO service_role;

ALTER TABLE public.partida_goleiros_fixos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros do grupo veem goleiros fixos"
  ON public.partida_goleiros_fixos FOR SELECT TO authenticated
  USING (public.is_grupo_member(public.grupo_de_pelada(pelada_id), auth.uid()));

CREATE POLICY "capitaes gerenciam goleiros fixos"
  ON public.partida_goleiros_fixos FOR ALL TO authenticated
  USING (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()))
  WITH CHECK (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));
