
CREATE TABLE public.times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id uuid NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.times TO authenticated;
GRANT ALL ON public.times TO service_role;
ALTER TABLE public.times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros veem times" ON public.times FOR SELECT TO authenticated
  USING (public.is_grupo_member(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "capitao cria times" ON public.times FOR INSERT TO authenticated
  WITH CHECK (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "capitao edita times" ON public.times FOR UPDATE TO authenticated
  USING (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "capitao remove times" ON public.times FOR DELETE TO authenticated
  USING (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));

CREATE TABLE public.time_jogadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_id uuid NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  pelada_id uuid NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  eh_goleiro boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pelada_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_jogadores TO authenticated;
GRANT ALL ON public.time_jogadores TO service_role;
ALTER TABLE public.time_jogadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros veem time_jogadores" ON public.time_jogadores FOR SELECT TO authenticated
  USING (public.is_grupo_member(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "capitao cria time_jogadores" ON public.time_jogadores FOR INSERT TO authenticated
  WITH CHECK (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "capitao edita time_jogadores" ON public.time_jogadores FOR UPDATE TO authenticated
  USING (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "capitao remove time_jogadores" ON public.time_jogadores FOR DELETE TO authenticated
  USING (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));

CREATE TABLE public.sorteio_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id uuid NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  realizado_por uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('primeiro_sorteio','ressorteiro_substituicao','ressorteiro_manual')),
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sorteio_log TO authenticated;
GRANT ALL ON public.sorteio_log TO service_role;
ALTER TABLE public.sorteio_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros veem sorteio_log" ON public.sorteio_log FOR SELECT TO authenticated
  USING (public.is_grupo_member(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "capitao cria sorteio_log" ON public.sorteio_log FOR INSERT TO authenticated
  WITH CHECK (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()) AND realizado_por = auth.uid());
