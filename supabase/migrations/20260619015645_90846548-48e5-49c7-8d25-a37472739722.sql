
-- ============ TABLES ============

CREATE TABLE IF NOT EXISTS public.avaliacoes_skill_membro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliador_id uuid NOT NULL,
  avaliado_id uuid NOT NULL,
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('conhecimento_previo','pos_pelada')),
  pelada_id uuid REFERENCES public.peladas(id) ON DELETE CASCADE,
  conhece_jogador boolean NOT NULL DEFAULT true,
  velocidade int CHECK (velocidade BETWEEN 1 AND 5),
  drible int CHECK (drible BETWEEN 1 AND 5),
  passe int CHECK (passe BETWEEN 1 AND 5),
  chute int CHECK (chute BETWEEN 1 AND 5),
  resistencia int CHECK (resistencia BETWEEN 1 AND 5),
  posicionamento int CHECK (posicionamento BETWEEN 1 AND 5),
  nota_desempenho_geral int CHECK (nota_desempenho_geral BETWEEN 1 AND 5),
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS avaliacoes_skill_membro_uniq
  ON public.avaliacoes_skill_membro (avaliador_id, avaliado_id, grupo_id, tipo, COALESCE(pelada_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes_skill_membro TO authenticated;
GRANT ALL ON public.avaliacoes_skill_membro TO service_role;
ALTER TABLE public.avaliacoes_skill_membro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros_grupo_select_avaliacoes" ON public.avaliacoes_skill_membro
  FOR SELECT TO authenticated USING (public.is_grupo_member(grupo_id, auth.uid()));
CREATE POLICY "avaliador_insere_avaliacao" ON public.avaliacoes_skill_membro
  FOR INSERT TO authenticated WITH CHECK (avaliador_id = auth.uid() AND public.is_grupo_member(grupo_id, auth.uid()));
CREATE POLICY "avaliador_atualiza_avaliacao" ON public.avaliacoes_skill_membro
  FOR UPDATE TO authenticated USING (avaliador_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.temporadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero int NOT NULL UNIQUE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','encerrada')),
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.temporadas TO authenticated, anon;
GRANT ALL ON public.temporadas TO service_role;
ALTER TABLE public.temporadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos_leem_temporadas" ON public.temporadas FOR SELECT TO authenticated, anon USING (true);

CREATE TABLE IF NOT EXISTS public.temporadas_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  temporada_id uuid NOT NULL REFERENCES public.temporadas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  velocidade_media numeric,
  drible_media numeric,
  passe_media numeric,
  chute_media numeric,
  resistencia_media numeric,
  posicionamento_media numeric,
  nivel_geral_inicio numeric,
  nivel_geral_fim numeric,
  variacao numeric,
  total_peladas_jogadas int DEFAULT 0,
  total_avaliacoes_recebidas int DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(temporada_id, user_id, grupo_id)
);
GRANT SELECT ON public.temporadas_snapshot TO authenticated;
GRANT ALL ON public.temporadas_snapshot TO service_role;
ALTER TABLE public.temporadas_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membros_leem_snapshot" ON public.temporadas_snapshot
  FOR SELECT TO authenticated USING (public.is_grupo_member(grupo_id, auth.uid()) OR user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.convites_indicacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicador_id uuid NOT NULL,
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  codigo_unico text NOT NULL UNIQUE,
  tipo_indicador text NOT NULL CHECK (tipo_indicador IN ('capitao','jogador')),
  ativo boolean NOT NULL DEFAULT true,
  convidado_id uuid,
  cadastrou boolean NOT NULL DEFAULT false,
  jogou_primeira_pelada boolean NOT NULL DEFAULT false,
  pontos_creditados boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS convites_indicacao_indicador_idx ON public.convites_indicacao(indicador_id, grupo_id);

GRANT SELECT, INSERT, UPDATE ON public.convites_indicacao TO authenticated;
GRANT SELECT ON public.convites_indicacao TO anon;
GRANT ALL ON public.convites_indicacao TO service_role;
ALTER TABLE public.convites_indicacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura_publica_codigo_indicacao" ON public.convites_indicacao FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "indicador_gerencia_proprios" ON public.convites_indicacao
  FOR INSERT TO authenticated WITH CHECK (indicador_id = auth.uid());
CREATE POLICY "indicador_atualiza_proprios" ON public.convites_indicacao
  FOR UPDATE TO authenticated USING (indicador_id = auth.uid());

-- Permitir convidados convidar (toggle no grupo)
ALTER TABLE public.grupos ADD COLUMN IF NOT EXISTS permite_membros_convidarem boolean NOT NULL DEFAULT false;

-- ============ SEED PONTOS_CONFIG ============
INSERT INTO public.pontos_config (acao, descricao, valor_pontos, multiplicador_capitao, ativo)
VALUES
  ('avaliou_novo_membro','Avaliou skills de novo membro do grupo',8,2.0,true),
  ('avaliou_pos_pelada','Avaliou desempenho após pelada',10,2.0,true),
  ('avaliou_todos_bonus','Avaliou TODOS os jogadores de uma pelada',20,2.0,true),
  ('avaliou_todos_grupo_bonus','Avaliou todos os membros do grupo (conhecimento prévio)',30,2.0,true),
  ('indicou_jogador_cadastrou','Indicado fez cadastro',15,2.0,true),
  ('indicou_jogador_jogou','Indicado jogou primeira pelada',30,2.0,true)
ON CONFLICT (acao) DO NOTHING;

-- ============ SEED PRIMEIRA TEMPORADA ============
INSERT INTO public.temporadas (numero, data_inicio, data_fim, status)
SELECT 1, CURRENT_DATE, CURRENT_DATE + 90, 'ativa'
WHERE NOT EXISTS (SELECT 1 FROM public.temporadas);

-- ============ FUNÇÕES ============

-- Recalcula skills com peso evolutivo capitao + média avaliadores
CREATE OR REPLACE FUNCTION public.recalcular_skills_jogador(_user_id uuid, _grupo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total int;
  _peso_cap numeric;
  _cap uuid;
  _av RECORD;
  _sk public.skills%ROWTYPE;
  _skc public.skills%ROWTYPE;
BEGIN
  SELECT count(*) INTO _total FROM public.avaliacoes_skill_membro
   WHERE avaliado_id = _user_id AND grupo_id = _grupo_id
     AND tipo = 'conhecimento_previo' AND conhece_jogador = true;
  _peso_cap := greatest(0, 1.0 - (_total * 0.1));

  SELECT user_id INTO _cap FROM public.grupo_membros
   WHERE grupo_id = _grupo_id AND papel = 'capitao' AND status = 'ativo' LIMIT 1;

  SELECT avg(velocidade)::numeric AS v, avg(drible)::numeric AS d, avg(passe)::numeric AS p,
         avg(chute)::numeric AS c, avg(resistencia)::numeric AS r, avg(posicionamento)::numeric AS po
    INTO _av
  FROM public.avaliacoes_skill_membro
  WHERE avaliado_id = _user_id AND grupo_id = _grupo_id
    AND tipo = 'conhecimento_previo' AND conhece_jogador = true
    AND avaliador_id <> COALESCE(_cap, '00000000-0000-0000-0000-000000000000'::uuid);

  SELECT * INTO _sk FROM public.skills WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.skills (user_id) VALUES (_user_id) RETURNING * INTO _sk;
  END IF;

  IF _total = 0 OR _av.v IS NULL THEN
    UPDATE public.skills
       SET peso_capitao_atual = _peso_cap,
           total_avaliacoes_recebidas = _total,
           origem_ultima_atualizacao = 'capitao'
     WHERE user_id = _user_id;
    RETURN;
  END IF;

  UPDATE public.skills SET
    velocidade = round(_sk.velocidade * _peso_cap + _av.v * (1 - _peso_cap))::int,
    drible = round(_sk.drible * _peso_cap + _av.d * (1 - _peso_cap))::int,
    passe = round(_sk.passe * _peso_cap + _av.p * (1 - _peso_cap))::int,
    chute = round(_sk.chute * _peso_cap + _av.c * (1 - _peso_cap))::int,
    resistencia = round(_sk.resistencia * _peso_cap + _av.r * (1 - _peso_cap))::int,
    posicionamento = round(_sk.posicionamento * _peso_cap + _av.po * (1 - _peso_cap))::int,
    peso_capitao_atual = _peso_cap,
    total_avaliacoes_recebidas = _total,
    origem_ultima_atualizacao = 'avaliacoes'
  WHERE user_id = _user_id;
END;
$$;

-- Trigger: ao inserir avaliação de conhecimento, recalcula skills + credita pontos
CREATE OR REPLACE FUNCTION public.trg_avaliacao_skill_inserida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _media numeric;
  _ajuste numeric := 0;
  _nivel_antes numeric;
  _nivel_depois numeric;
  _grupos uuid[];
  _g uuid;
  _nome text;
BEGIN
  IF NEW.tipo = 'conhecimento_previo' AND NEW.conhece_jogador = true THEN
    PERFORM public.recalcular_skills_jogador(NEW.avaliado_id, NEW.grupo_id);
    PERFORM public.creditar_pontos(NEW.avaliador_id, 'avaliou_novo_membro', NULL);
  ELSIF NEW.tipo = 'pos_pelada' AND NEW.nota_desempenho_geral IS NOT NULL THEN
    PERFORM public.creditar_pontos(NEW.avaliador_id, 'avaliou_pos_pelada', NEW.pelada_id);

    SELECT avg(nota_desempenho_geral)::numeric INTO _media
      FROM public.avaliacoes_skill_membro
     WHERE avaliado_id = NEW.avaliado_id AND pelada_id = NEW.pelada_id AND tipo = 'pos_pelada';

    IF _media > 3.5 THEN _ajuste := 0.1;
    ELSIF _media < 2.5 THEN _ajuste := -0.1;
    END IF;

    IF _ajuste <> 0 THEN
      _nivel_antes := public.media_skill_user(NEW.avaliado_id);
      UPDATE public.skills SET
        velocidade = greatest(1, least(5, round(velocidade + _ajuste)::int)),
        drible = greatest(1, least(5, round(drible + _ajuste)::int)),
        passe = greatest(1, least(5, round(passe + _ajuste)::int)),
        chute = greatest(1, least(5, round(chute + _ajuste)::int)),
        resistencia = greatest(1, least(5, round(resistencia + _ajuste)::int)),
        posicionamento = greatest(1, least(5, round(posicionamento + _ajuste)::int)),
        origem_ultima_atualizacao = 'pos_pelada'
       WHERE user_id = NEW.avaliado_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS avaliacao_skill_after_insert ON public.avaliacoes_skill_membro;
CREATE TRIGGER avaliacao_skill_after_insert
  AFTER INSERT ON public.avaliacoes_skill_membro
  FOR EACH ROW EXECUTE FUNCTION public.trg_avaliacao_skill_inserida();

-- Trigger: novo membro entra → notificar membros para avaliar
CREATE OR REPLACE FUNCTION public.trg_novo_membro_avaliar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _nome text;
BEGIN
  IF NEW.status = 'ativo' THEN
    SELECT nome INTO _nome FROM public.profiles WHERE user_id = NEW.user_id;
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, tipo, dados_extras, link)
    SELECT gm.user_id,
      '👋 Novo membro no grupo!',
      COALESCE(_nome,'Alguém') || ' entrou no grupo! Você conhece o nível dele? Avalie e ganhe pontos!',
      'avaliar_novo_membro',
      jsonb_build_object('avaliado_id', NEW.user_id, 'grupo_id', NEW.grupo_id),
      '/grupos/' || NEW.grupo_id::text
    FROM public.grupo_membros gm
    WHERE gm.grupo_id = NEW.grupo_id AND gm.status='ativo' AND gm.user_id <> NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS novo_membro_avaliar ON public.grupo_membros;
CREATE TRIGGER novo_membro_avaliar
  AFTER INSERT ON public.grupo_membros
  FOR EACH ROW EXECUTE FUNCTION public.trg_novo_membro_avaliar();

-- Função: criar código de indicação
CREATE OR REPLACE FUNCTION public.criar_codigo_indicacao(_user_id uuid, _grupo_id uuid, _tipo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _existing text; _code text;
BEGIN
  SELECT codigo_unico INTO _existing FROM public.convites_indicacao
   WHERE indicador_id = _user_id AND grupo_id = _grupo_id LIMIT 1;
  IF _existing IS NOT NULL THEN
    UPDATE public.convites_indicacao SET ativo = true WHERE codigo_unico = _existing;
    RETURN _existing;
  END IF;
  _code := 'FZ-IND-' || upper(substr(md5(random()::text || _user_id::text), 1, 5));
  INSERT INTO public.convites_indicacao (indicador_id, grupo_id, codigo_unico, tipo_indicador)
  VALUES (_user_id, _grupo_id, _code, _tipo);
  RETURN _code;
END;
$$;

-- Trigger: ao criar grupo, criar código do capitão
CREATE OR REPLACE FUNCTION public.trg_grupo_codigo_indicacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.criar_codigo_indicacao(NEW.criado_por, NEW.id, 'capitao');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grupo_codigo_indicacao ON public.grupos;
CREATE TRIGGER grupo_codigo_indicacao
  AFTER INSERT ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.trg_grupo_codigo_indicacao();

-- Trigger: ao jogar primeira pelada, creditar indicador
CREATE OR REPLACE FUNCTION public.trg_creditar_indicacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _ind public.convites_indicacao%ROWTYPE;
BEGIN
  IF NEW.status = 'confirmado' THEN
    SELECT * INTO _ind FROM public.convites_indicacao
     WHERE convidado_id = NEW.user_id AND cadastrou = true
       AND jogou_primeira_pelada = false AND pontos_creditados = false
     LIMIT 1;
    IF FOUND THEN
      UPDATE public.convites_indicacao
         SET jogou_primeira_pelada = true, pontos_creditados = true
       WHERE id = _ind.id;
      PERFORM public.creditar_pontos(_ind.indicador_id, 'indicou_jogador_jogou', NEW.pelada_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creditar_indicacao_primeira_pelada ON public.pelada_confirmacoes;
CREATE TRIGGER creditar_indicacao_primeira_pelada
  AFTER INSERT ON public.pelada_confirmacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_creditar_indicacao();

-- Função: fechar temporada
CREATE OR REPLACE FUNCTION public.fechar_temporada(_temporada_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _t public.temporadas%ROWTYPE; _r RECORD; _mvp RECORD; _evo RECORD; _queda RECORD;
BEGIN
  SELECT * INTO _t FROM public.temporadas WHERE id = _temporada_id;
  IF NOT FOUND OR _t.status = 'encerrada' THEN RETURN; END IF;

  FOR _r IN
    SELECT DISTINCT gm.user_id, gm.grupo_id
    FROM public.grupo_membros gm WHERE gm.status='ativo'
  LOOP
    INSERT INTO public.temporadas_snapshot (
      temporada_id, user_id, grupo_id,
      velocidade_media, drible_media, passe_media, chute_media, resistencia_media, posicionamento_media,
      nivel_geral_fim, total_peladas_jogadas, total_avaliacoes_recebidas
    )
    SELECT _temporada_id, _r.user_id, _r.grupo_id,
      s.velocidade, s.drible, s.passe, s.chute, s.resistencia, s.posicionamento,
      public.media_skill_user(_r.user_id),
      (SELECT count(DISTINCT tj.pelada_id) FROM public.time_jogadores tj
        JOIN public.peladas p ON p.id = tj.pelada_id
       WHERE tj.user_id = _r.user_id AND p.grupo_id = _r.grupo_id
         AND p.data BETWEEN _t.data_inicio AND _t.data_fim),
      (SELECT count(*) FROM public.avaliacoes_skill_membro a
       WHERE a.avaliado_id = _r.user_id AND a.grupo_id = _r.grupo_id
         AND a.criado_em::date BETWEEN _t.data_inicio AND _t.data_fim)
    FROM public.skills s WHERE s.user_id = _r.user_id
    ON CONFLICT DO NOTHING;
  END LOOP;

  UPDATE public.temporadas SET status='encerrada' WHERE id=_temporada_id;
  INSERT INTO public.temporadas (numero, data_inicio, data_fim, status)
  VALUES (_t.numero + 1, CURRENT_DATE, CURRENT_DATE + 90, 'ativa');
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalcular_skills_jogador(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_codigo_indicacao(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_temporada(uuid) TO service_role;
