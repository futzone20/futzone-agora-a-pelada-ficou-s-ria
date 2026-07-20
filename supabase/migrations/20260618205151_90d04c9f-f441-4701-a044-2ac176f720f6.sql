
ALTER TABLE public.quadras_publicas ADD COLUMN IF NOT EXISTS slug_arena text;
ALTER TABLE public.quadras_publicas ADD COLUMN IF NOT EXISTS slug_quadra text;
CREATE UNIQUE INDEX IF NOT EXISTS quadras_publicas_slug_unique ON public.quadras_publicas (slug_arena, slug_quadra);

CREATE TYPE public.status_partida AS ENUM ('aguardando','em_andamento','encerrada');

CREATE TABLE public.partidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id uuid NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  numero_partida int NOT NULL,
  time_a_id uuid NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  time_b_id uuid NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  time_fora_id uuid REFERENCES public.times(id) ON DELETE SET NULL,
  placar_a int NOT NULL DEFAULT 0,
  placar_b int NOT NULL DEFAULT 0,
  status public.status_partida NOT NULL DEFAULT 'aguardando',
  duracao_minutos int NOT NULL DEFAULT 10,
  iniciada_em timestamptz,
  encerrada_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partidas TO authenticated;
GRANT SELECT ON public.partidas TO anon;
GRANT ALL ON public.partidas TO service_role;
ALTER TABLE public.partidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publico ve partidas" ON public.partidas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "capitao cria partidas" ON public.partidas FOR INSERT TO authenticated
  WITH CHECK (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "capitao edita partidas" ON public.partidas FOR UPDATE TO authenticated
  USING (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "capitao remove partidas" ON public.partidas FOR DELETE TO authenticated
  USING (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));

CREATE TABLE public.auxiliares_partida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id uuid NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  pelada_id uuid NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  time_fora_id uuid REFERENCES public.times(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partida_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auxiliares_partida TO authenticated;
GRANT SELECT ON public.auxiliares_partida TO anon;
GRANT ALL ON public.auxiliares_partida TO service_role;
ALTER TABLE public.auxiliares_partida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publico ve auxiliares" ON public.auxiliares_partida FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "capitao gerencia auxiliares" ON public.auxiliares_partida FOR ALL TO authenticated
  USING (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()))
  WITH CHECK (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));

CREATE TYPE public.tipo_lance AS ENUM ('gol','passe_decisivo','defesa','falta','outro');

CREATE TABLE public.lances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id uuid NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  pelada_id uuid NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  tipo public.tipo_lance NOT NULL,
  user_id uuid NOT NULL,
  time_id uuid NOT NULL REFERENCES public.times(id) ON DELETE CASCADE,
  marcado_por uuid NOT NULL,
  descricao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lances TO authenticated;
GRANT SELECT ON public.lances TO anon;
GRANT ALL ON public.lances TO service_role;
ALTER TABLE public.lances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publico ve lances" ON public.lances FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "auxiliar ou capitao cria lances" ON public.lances FOR INSERT TO authenticated
  WITH CHECK (
    public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid())
    OR EXISTS (SELECT 1 FROM public.auxiliares_partida ap WHERE ap.partida_id = partida_id AND ap.user_id = auth.uid())
  );
CREATE POLICY "auxiliar ou capitao remove lances" ON public.lances FOR DELETE TO authenticated
  USING (
    public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid())
    OR marcado_por = auth.uid()
  );

CREATE TABLE public.lances_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lance_id uuid,
  pelada_id uuid NOT NULL,
  acao text NOT NULL CHECK (acao IN ('criado','excluido','editado')),
  feito_por uuid NOT NULL,
  feito_em timestamptz NOT NULL DEFAULT now(),
  dado_anterior jsonb
);
GRANT SELECT, INSERT ON public.lances_auditoria TO authenticated;
GRANT ALL ON public.lances_auditoria TO service_role;
ALTER TABLE public.lances_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros veem auditoria" ON public.lances_auditoria FOR SELECT TO authenticated
  USING (public.is_grupo_member(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "sistema insere auditoria" ON public.lances_auditoria FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.placar_sessao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id uuid NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  ativa boolean NOT NULL DEFAULT true,
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  encerrada_em timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.placar_sessao TO authenticated;
GRANT SELECT ON public.placar_sessao TO anon;
GRANT ALL ON public.placar_sessao TO service_role;
ALTER TABLE public.placar_sessao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publico ve placar_sessao" ON public.placar_sessao FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "capitao gerencia placar_sessao" ON public.placar_sessao FOR ALL TO authenticated
  USING (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()))
  WITH CHECK (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_lance_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.partidas%ROWTYPE;
BEGIN
  IF NEW.tipo = 'gol' THEN
    SELECT * INTO _p FROM public.partidas WHERE id = NEW.partida_id;
    IF NEW.time_id = _p.time_a_id THEN
      UPDATE public.partidas SET placar_a = placar_a + 1 WHERE id = NEW.partida_id;
    ELSIF NEW.time_id = _p.time_b_id THEN
      UPDATE public.partidas SET placar_b = placar_b + 1 WHERE id = NEW.partida_id;
    END IF;
  END IF;
  INSERT INTO public.lances_auditoria (lance_id, pelada_id, acao, feito_por, dado_anterior)
  VALUES (NEW.id, NEW.pelada_id, 'criado', NEW.marcado_por, to_jsonb(NEW));
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_lance_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_lance_insert AFTER INSERT ON public.lances
FOR EACH ROW EXECUTE FUNCTION public.handle_lance_insert();

CREATE OR REPLACE FUNCTION public.handle_lance_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _p public.partidas%ROWTYPE;
BEGIN
  IF OLD.tipo = 'gol' THEN
    SELECT * INTO _p FROM public.partidas WHERE id = OLD.partida_id;
    IF OLD.time_id = _p.time_a_id THEN
      UPDATE public.partidas SET placar_a = greatest(placar_a - 1, 0) WHERE id = OLD.partida_id;
    ELSIF OLD.time_id = _p.time_b_id THEN
      UPDATE public.partidas SET placar_b = greatest(placar_b - 1, 0) WHERE id = OLD.partida_id;
    END IF;
  END IF;
  INSERT INTO public.lances_auditoria (lance_id, pelada_id, acao, feito_por, dado_anterior)
  VALUES (OLD.id, OLD.pelada_id, 'excluido', COALESCE(auth.uid(), OLD.marcado_por), to_jsonb(OLD));
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_lance_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_lance_delete AFTER DELETE ON public.lances
FOR EACH ROW EXECUTE FUNCTION public.handle_lance_delete();

ALTER PUBLICATION supabase_realtime ADD TABLE public.partidas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.peladas;

CREATE POLICY "publico ve peladas" ON public.peladas FOR SELECT TO anon USING (true);
CREATE POLICY "publico ve times" ON public.times FOR SELECT TO anon USING (true);
CREATE POLICY "publico ve time_jogadores" ON public.time_jogadores FOR SELECT TO anon USING (true);
CREATE POLICY "publico ve profiles basico" ON public.profiles FOR SELECT TO anon USING (true);
GRANT SELECT ON public.peladas TO anon;
GRANT SELECT ON public.times TO anon;
GRANT SELECT ON public.time_jogadores TO anon;
GRANT SELECT ON public.quadras_publicas TO anon;
GRANT SELECT ON public.profiles TO anon;
