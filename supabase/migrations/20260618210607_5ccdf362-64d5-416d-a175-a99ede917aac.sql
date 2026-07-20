
-- =========================
-- FASE 6: tabelas
-- =========================

ALTER TABLE public.peladas
  ADD COLUMN IF NOT EXISTS avaliacao_aberta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avaliacao_fecha_em timestamptz,
  ADD COLUMN IF NOT EXISTS mvp_user_id uuid;

-- FEED POSTS
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  pelada_id uuid REFERENCES public.peladas(id) ON DELETE CASCADE,
  user_id uuid,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feed_posts_select" ON public.feed_posts FOR SELECT TO authenticated
USING (grupo_id IS NULL OR public.is_grupo_member(grupo_id, auth.uid()));
CREATE POLICY "feed_posts_insert_system" ON public.feed_posts FOR INSERT TO authenticated
WITH CHECK (false);
CREATE POLICY "feed_posts_delete_admin" ON public.feed_posts FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR (grupo_id IS NOT NULL AND public.is_grupo_capitao(grupo_id, auth.uid())));

CREATE INDEX IF NOT EXISTS idx_feed_posts_grupo_criado ON public.feed_posts (grupo_id, criado_em DESC);

-- REACOES
CREATE TABLE IF NOT EXISTS public.feed_reacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  tipo text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_reacoes TO authenticated;
GRANT ALL ON public.feed_reacoes TO service_role;
ALTER TABLE public.feed_reacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reacoes_select" ON public.feed_reacoes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND (p.grupo_id IS NULL OR public.is_grupo_member(p.grupo_id, auth.uid()))));
CREATE POLICY "reacoes_insert" ON public.feed_reacoes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND (p.grupo_id IS NULL OR public.is_grupo_member(p.grupo_id, auth.uid()))));
CREATE POLICY "reacoes_delete_own" ON public.feed_reacoes FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- COMENTARIOS
CREATE TABLE IF NOT EXISTS public.feed_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  texto text NOT NULL CHECK (char_length(texto) <= 140),
  deletado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_comentarios TO authenticated;
GRANT ALL ON public.feed_comentarios TO service_role;
ALTER TABLE public.feed_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coment_select" ON public.feed_comentarios FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND (p.grupo_id IS NULL OR public.is_grupo_member(p.grupo_id, auth.uid()))));
CREATE POLICY "coment_insert" ON public.feed_comentarios FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND (p.grupo_id IS NULL OR public.is_grupo_member(p.grupo_id, auth.uid()))));
CREATE POLICY "coment_update" ON public.feed_comentarios FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.feed_posts p WHERE p.id = post_id AND p.grupo_id IS NOT NULL AND public.is_grupo_capitao(p.grupo_id, auth.uid())))
WITH CHECK (true);

-- AVALIACOES POS PELADA
CREATE TABLE IF NOT EXISTS public.avaliacoes_pos_pelada (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id uuid NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  avaliador_id uuid NOT NULL,
  avaliado_id uuid NOT NULL,
  gols_confirmados int NOT NULL DEFAULT 0,
  passes_confirmados int NOT NULL DEFAULT 0,
  defesas_confirmadas int NOT NULL DEFAULT 0,
  nota_geral int NOT NULL CHECK (nota_geral BETWEEN 1 AND 5),
  nota_comportamento int NOT NULL CHECK (nota_comportamento BETWEEN 1 AND 5),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pelada_id, avaliador_id, avaliado_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes_pos_pelada TO authenticated;
GRANT ALL ON public.avaliacoes_pos_pelada TO service_role;
ALTER TABLE public.avaliacoes_pos_pelada ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aval_select_membros" ON public.avaliacoes_pos_pelada FOR SELECT TO authenticated
USING (avaliador_id = auth.uid() OR avaliado_id = auth.uid() OR public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "aval_insert_self" ON public.avaliacoes_pos_pelada FOR INSERT TO authenticated
WITH CHECK (avaliador_id = auth.uid() AND avaliador_id <> avaliado_id);

-- MVP VOTOS
CREATE TABLE IF NOT EXISTS public.mvp_votos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id uuid NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  votante_id uuid NOT NULL,
  votado_id uuid NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pelada_id, votante_id),
  CHECK (votante_id <> votado_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mvp_votos TO authenticated;
GRANT ALL ON public.mvp_votos TO service_role;
ALTER TABLE public.mvp_votos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mvp_select" ON public.mvp_votos FOR SELECT TO authenticated
USING (public.is_grupo_member(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "mvp_insert_self" ON public.mvp_votos FOR INSERT TO authenticated
WITH CHECK (votante_id = auth.uid());

-- =========================
-- REALTIME
-- =========================
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_reacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_comentarios;

-- =========================
-- FUNCAO: criar post (interno)
-- =========================
CREATE OR REPLACE FUNCTION public.criar_feed_post(_grupo uuid, _tipo text, _pelada uuid, _user uuid, _conteudo jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.feed_posts (grupo_id, tipo, pelada_id, user_id, conteudo)
  VALUES (_grupo, _tipo, _pelada, _user, COALESCE(_conteudo, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

-- =========================
-- FUNCAO: gerar posts ao encerrar a pelada
-- =========================
CREATE OR REPLACE FUNCTION public.gerar_posts_pelada(_pelada_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pel public.peladas%ROWTYPE;
  _vencedor_time uuid;
  _vencedor_nome text;
  _vencedor_cor text;
  _placar text;
  _partidas int;
  _vitorias_a int;
  _vitorias_b int;
  _artilheiro RECORD;
  _mvp RECORD;
  _jogadores jsonb;
BEGIN
  SELECT * INTO _pel FROM public.peladas WHERE id = _pelada_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Resultado: time com mais vitórias somadas
  SELECT count(*) FILTER (WHERE placar_a > placar_b),
         count(*) FILTER (WHERE placar_b > placar_a),
         count(*)
    INTO _vitorias_a, _vitorias_b, _partidas
  FROM public.partidas WHERE pelada_id = _pelada_id AND status = 'encerrada';

  IF _partidas > 0 THEN
    IF _vitorias_a >= _vitorias_b THEN
      SELECT time_a_id INTO _vencedor_time FROM public.partidas WHERE pelada_id=_pelada_id ORDER BY numero_partida LIMIT 1;
    ELSE
      SELECT time_b_id INTO _vencedor_time FROM public.partidas WHERE pelada_id=_pelada_id ORDER BY numero_partida LIMIT 1;
    END IF;
    SELECT nome, cor INTO _vencedor_nome, _vencedor_cor FROM public.times WHERE id = _vencedor_time;
    _placar := _vitorias_a || ' x ' || _vitorias_b;

    SELECT jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nome', pr.nome))
      INTO _jogadores
    FROM public.time_jogadores p
    LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.time_id = _vencedor_time;

    PERFORM public.criar_feed_post(_pel.grupo_id, 'resultado_pelada', _pelada_id, NULL,
      jsonb_build_object('time_vencedor', _vencedor_nome, 'cor_time', _vencedor_cor,
        'placar', _placar, 'partidas_jogadas', _partidas, 'jogadores_vencedores', COALESCE(_jogadores,'[]'::jsonb),
        'pelada_nome', _pel.nome_pelada));
  END IF;

  -- Artilheiro
  SELECT l.user_id, count(*) AS gols, pr.nome
    INTO _artilheiro
  FROM public.lances l
  LEFT JOIN public.profiles pr ON pr.user_id = l.user_id
  WHERE l.pelada_id = _pelada_id AND l.tipo = 'gol'
  GROUP BY l.user_id, pr.nome
  ORDER BY gols DESC LIMIT 1;
  IF _artilheiro.gols >= 2 THEN
    PERFORM public.criar_feed_post(_pel.grupo_id, 'artilheiro', _pelada_id, _artilheiro.user_id,
      jsonb_build_object('nome', _artilheiro.nome, 'gols', _artilheiro.gols, 'pelada_nome', _pel.nome_pelada));
  END IF;

  -- MVP
  SELECT votado_id, count(*) AS votos INTO _mvp
  FROM public.mvp_votos WHERE pelada_id = _pelada_id
  GROUP BY votado_id ORDER BY votos DESC LIMIT 1;
  IF _mvp.votado_id IS NOT NULL THEN
    UPDATE public.peladas SET mvp_user_id = _mvp.votado_id WHERE id = _pelada_id;
    PERFORM public.criar_feed_post(_pel.grupo_id, 'mvp', _pelada_id, _mvp.votado_id,
      jsonb_build_object(
        'nome', (SELECT nome FROM public.profiles WHERE user_id = _mvp.votado_id),
        'pelada_nome', _pel.nome_pelada,
        'gols', (SELECT count(*) FROM public.lances WHERE pelada_id=_pelada_id AND user_id=_mvp.votado_id AND tipo='gol'),
        'passes', (SELECT count(*) FROM public.lances WHERE pelada_id=_pelada_id AND user_id=_mvp.votado_id AND tipo='passe_decisivo')));
    PERFORM public.creditar_pontos(_mvp.votado_id, 'foi_mvp', _pelada_id);
  END IF;
END; $$;

-- =========================
-- TRIGGER: ao encerrar pelada, abrir janela e gerar posts
-- =========================
CREATE OR REPLACE FUNCTION public.trg_pelada_encerrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'encerrada' AND OLD.status IS DISTINCT FROM 'encerrada' THEN
    NEW.avaliacao_aberta := true;
    NEW.avaliacao_fecha_em := now() + interval '24 hours';
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
    SELECT DISTINCT tj.user_id, '📋 A pelada acabou!',
      'Avalie os jogadores e vote no MVP da pelada.',
      '/peladas/' || NEW.id::text || '/avaliar'
    FROM public.time_jogadores tj WHERE tj.pelada_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS pelada_encerrada_trigger ON public.peladas;
CREATE TRIGGER pelada_encerrada_trigger BEFORE UPDATE ON public.peladas
FOR EACH ROW EXECUTE FUNCTION public.trg_pelada_encerrada();

CREATE OR REPLACE FUNCTION public.trg_pelada_encerrada_posts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'encerrada' AND OLD.status IS DISTINCT FROM 'encerrada' THEN
    PERFORM public.gerar_posts_pelada(NEW.id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS pelada_encerrada_posts_trigger ON public.peladas;
CREATE TRIGGER pelada_encerrada_posts_trigger AFTER UPDATE ON public.peladas
FOR EACH ROW EXECUTE FUNCTION public.trg_pelada_encerrada_posts();

-- =========================
-- Atualizar check_selos para gerar post quando ganha selo
-- =========================
CREATE OR REPLACE FUNCTION public.check_selos(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _stats jsonb; _selo public.selos%ROWTYPE; _val numeric; _grupos uuid[];
BEGIN
  _stats := public.user_stats(_user_id);
  SELECT array_agg(DISTINCT grupo_id) INTO _grupos FROM public.grupo_membros WHERE user_id = _user_id AND status='ativo';
  FOR _selo IN SELECT * FROM public.selos WHERE ativo LOOP
    IF EXISTS (SELECT 1 FROM public.usuario_selos WHERE user_id = _user_id AND selo_id = _selo.id) THEN CONTINUE; END IF;
    _val := COALESCE((_stats ->> _selo.condicao_campo)::numeric, 0);
    IF _val >= _selo.condicao_valor THEN
      INSERT INTO public.usuario_selos (user_id, selo_id) VALUES (_user_id, _selo.id) ON CONFLICT DO NOTHING;
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (_user_id, _selo.icone_emoji || ' Novo selo: ' || _selo.nome,
        'Você conquistou o selo ' || _selo.nome || '!', '/jogador/perfil');
      IF _grupos IS NOT NULL THEN
        PERFORM public.criar_feed_post(g, 'novo_selo', NULL, _user_id,
          jsonb_build_object('nome', (SELECT nome FROM public.profiles WHERE user_id=_user_id),
            'selo_codigo', _selo.codigo, 'selo_nome', _selo.nome, 'selo_emoji', _selo.icone_emoji))
        FROM unnest(_grupos) AS g;
      END IF;
    END IF;
  END LOOP;
END; $$;

-- =========================
-- Post quando entra novo membro
-- =========================
CREATE OR REPLACE FUNCTION public.trg_novo_membro_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nome text; _grupo_nome text;
BEGIN
  IF NEW.status = 'ativo' THEN
    SELECT nome INTO _nome FROM public.profiles WHERE user_id = NEW.user_id;
    SELECT nome INTO _grupo_nome FROM public.grupos WHERE id = NEW.grupo_id;
    PERFORM public.criar_feed_post(NEW.grupo_id, 'novo_membro', NULL, NEW.user_id,
      jsonb_build_object('nome', _nome, 'grupo_nome', _grupo_nome));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS novo_membro_post_trigger ON public.grupo_membros;
CREATE TRIGGER novo_membro_post_trigger AFTER INSERT ON public.grupo_membros
FOR EACH ROW EXECUTE FUNCTION public.trg_novo_membro_post();

-- =========================
-- Ofensiva: gerar post nos marcos
-- =========================
CREATE OR REPLACE FUNCTION public.atualizar_ofensiva(_user_id uuid, _data date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _o public.ofensivas%ROWTYPE; _nova int;
  _marcos int[] := ARRAY[5,10,20,50]; _m int;
  _nome text; _grupos uuid[];
BEGIN
  SELECT * INTO _o FROM public.ofensivas WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.ofensivas (user_id, sequencia_atual, maior_sequencia, ultima_pelada_em)
    VALUES (_user_id, 1, 1, _data);
    _nova := 1;
  ELSE
    IF _o.ultima_pelada_em IS NULL OR (_data - _o.ultima_pelada_em) > 14 THEN
      _nova := 1;
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (_user_id, '💔 Ofensiva resetada', 'Sua ofensiva foi resetada. Volte a jogar!', '/jogador');
    ELSE
      _nova := _o.sequencia_atual + 1;
    END IF;
    UPDATE public.ofensivas SET sequencia_atual=_nova,
      maior_sequencia=greatest(_o.maior_sequencia,_nova),
      ultima_pelada_em=_data, atualizado_em=now() WHERE user_id=_user_id;
  END IF;
  FOREACH _m IN ARRAY _marcos LOOP
    IF _nova = _m THEN
      PERFORM public.creditar_pontos(_user_id, 'ofensiva_'||_m::text, NULL);
      SELECT nome INTO _nome FROM public.profiles WHERE user_id=_user_id;
      SELECT array_agg(DISTINCT grupo_id) INTO _grupos FROM public.grupo_membros WHERE user_id=_user_id AND status='ativo';
      IF _grupos IS NOT NULL THEN
        PERFORM public.criar_feed_post(g, 'nova_ofensiva', NULL, _user_id,
          jsonb_build_object('nome', _nome, 'sequencia', _nova))
        FROM unnest(_grupos) AS g;
      END IF;
    END IF;
  END LOOP;
END; $$;

-- ponto config para foi_mvp e avaliou_jogadores
INSERT INTO public.pontos_config (acao, descricao, valor_pontos, multiplicador_capitao, ativo)
VALUES
  ('foi_mvp', 'Eleito MVP da pelada', 50, 1.0, true),
  ('avaliou_jogadores', 'Avaliou os jogadores após a pelada', 5, 1.0, true)
ON CONFLICT (acao) DO NOTHING;
