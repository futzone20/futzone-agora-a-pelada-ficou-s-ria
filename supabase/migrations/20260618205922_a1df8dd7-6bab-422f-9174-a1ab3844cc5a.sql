
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pontos_total int NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS estado text;

CREATE TABLE public.pontos_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao text UNIQUE NOT NULL,
  descricao text NOT NULL,
  valor_pontos int NOT NULL,
  multiplicador_capitao numeric NOT NULL DEFAULT 1.0,
  ativo boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.pontos_config TO anon, authenticated;
GRANT ALL ON public.pontos_config TO service_role;
ALTER TABLE public.pontos_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos veem pontos_config" ON public.pontos_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin gerencia pontos_config" ON public.pontos_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.pontos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  acao text NOT NULL,
  pelada_id uuid REFERENCES public.peladas(id) ON DELETE SET NULL,
  valor_pontos int NOT NULL,
  saldo_apos int NOT NULL,
  descricao_legivel text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pontos_historico TO authenticated;
GRANT ALL ON public.pontos_historico TO service_role;
ALTER TABLE public.pontos_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario ve seu historico" ON public.pontos_historico FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX pontos_historico_user_idx ON public.pontos_historico (user_id, criado_em DESC);

CREATE TABLE public.ofensivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL,
  sequencia_atual int NOT NULL DEFAULT 0,
  maior_sequencia int NOT NULL DEFAULT 0,
  ultima_pelada_em date,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ofensivas TO anon, authenticated;
GRANT ALL ON public.ofensivas TO service_role;
ALTER TABLE public.ofensivas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos veem ofensivas" ON public.ofensivas FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.selos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nome text NOT NULL,
  descricao text,
  icone_emoji text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('habilidade','comportamento','progressao','engajamento')),
  condicao_tipo text NOT NULL DEFAULT 'contagem',
  condicao_campo text NOT NULL,
  condicao_valor numeric NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.selos TO anon, authenticated;
GRANT ALL ON public.selos TO service_role;
ALTER TABLE public.selos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos veem selos" ON public.selos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin gerencia selos" ON public.selos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.usuario_selos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  selo_id uuid NOT NULL REFERENCES public.selos(id) ON DELETE CASCADE,
  conquistado_em timestamptz NOT NULL DEFAULT now(),
  exibir_no_perfil boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, selo_id)
);
GRANT SELECT, UPDATE ON public.usuario_selos TO authenticated;
GRANT SELECT ON public.usuario_selos TO anon;
GRANT ALL ON public.usuario_selos TO service_role;
ALTER TABLE public.usuario_selos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos veem usuario_selos" ON public.usuario_selos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "usuario edita seus selos" ON public.usuario_selos FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.desafios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'semanal' CHECK (tipo IN ('semanal','mensal')),
  acao_alvo text NOT NULL,
  quantidade_alvo int NOT NULL,
  pontos_recompensa int NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.desafios TO anon, authenticated;
GRANT ALL ON public.desafios TO service_role;
ALTER TABLE public.desafios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos veem desafios" ON public.desafios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin gerencia desafios" ON public.desafios FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.desafios_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  desafio_id uuid NOT NULL REFERENCES public.desafios(id) ON DELETE CASCADE,
  progresso_atual int NOT NULL DEFAULT 0,
  concluido boolean NOT NULL DEFAULT false,
  periodo_referencia text NOT NULL,
  concluido_em timestamptz,
  UNIQUE (user_id, desafio_id, periodo_referencia)
);
GRANT SELECT ON public.desafios_progresso TO authenticated;
GRANT ALL ON public.desafios_progresso TO service_role;
ALTER TABLE public.desafios_progresso ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario ve seu progresso" ON public.desafios_progresso FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.rankings_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('pelada','mensal','global')),
  referencia_id text NOT NULL,
  user_id uuid NOT NULL,
  posicao int NOT NULL,
  pontos_periodo int NOT NULL DEFAULT 0,
  gols_periodo int NOT NULL DEFAULT 0,
  passes_periodo int NOT NULL DEFAULT 0,
  defesas_periodo int NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rankings_snapshot TO anon, authenticated;
GRANT ALL ON public.rankings_snapshot TO service_role;
ALTER TABLE public.rankings_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos veem rankings" ON public.rankings_snapshot FOR SELECT TO anon, authenticated USING (true);

-- ====== FUNÇÕES ======

CREATE OR REPLACE FUNCTION public.creditar_pontos(_user_id uuid, _acao text, _pelada_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _cfg public.pontos_config%ROWTYPE;
  _role public.app_role;
  _mult numeric := 1.0;
  _valor int;
  _novo_saldo int;
BEGIN
  SELECT * INTO _cfg FROM public.pontos_config WHERE acao = _acao AND ativo;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT role INTO _role FROM public.profiles WHERE user_id = _user_id;
  IF _role = 'capitao' AND _cfg.valor_pontos > 0 THEN _mult := _cfg.multiplicador_capitao; END IF;
  _valor := round(_cfg.valor_pontos * _mult);
  UPDATE public.profiles SET pontos_total = pontos_total + _valor WHERE user_id = _user_id
    RETURNING pontos_total INTO _novo_saldo;
  IF _novo_saldo IS NULL THEN RETURN; END IF;
  INSERT INTO public.pontos_historico (user_id, acao, pelada_id, valor_pontos, saldo_apos, descricao_legivel)
  VALUES (_user_id, _acao, _pelada_id, _valor, _novo_saldo, _cfg.descricao);
  PERFORM public.check_selos(_user_id);
  PERFORM public.atualizar_desafios(_user_id, _acao);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.creditar_pontos(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.user_stats(_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'pontos_total', COALESCE((SELECT pontos_total FROM public.profiles WHERE user_id = _user_id), 0),
    'gols_total', COALESCE((SELECT count(*) FROM public.lances WHERE user_id = _user_id AND tipo='gol'), 0),
    'passes_total', COALESCE((SELECT count(*) FROM public.lances WHERE user_id = _user_id AND tipo='passe_decisivo'), 0),
    'defesas_total', COALESCE((SELECT count(*) FROM public.lances WHERE user_id = _user_id AND tipo='defesa'), 0),
    'peladas_total', COALESCE((SELECT count(DISTINCT pelada_id) FROM public.time_jogadores WHERE user_id = _user_id), 0),
    'auxiliar_total', COALESCE((SELECT count(*) FROM public.auxiliares_partida WHERE user_id = _user_id), 0),
    'cancelamentos_tarde', COALESCE((SELECT count(*) FROM public.pelada_confirmacoes WHERE user_id = _user_id AND status='cancelado_tarde'), 0),
    'ofensiva_atual', COALESCE((SELECT sequencia_atual FROM public.ofensivas WHERE user_id = _user_id), 0),
    'indicacoes_total', 0,
    'faltas_consecutivas', 0,
    'media_avaliacao_geral', 5.0,
    'media_avaliacao_comportamento', 5.0
  );
$$;
REVOKE EXECUTE ON FUNCTION public.user_stats(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_selos(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _stats jsonb;
  _selo public.selos%ROWTYPE;
  _val numeric;
  _nome text;
BEGIN
  _stats := public.user_stats(_user_id);
  FOR _selo IN SELECT * FROM public.selos WHERE ativo LOOP
    IF EXISTS (SELECT 1 FROM public.usuario_selos WHERE user_id = _user_id AND selo_id = _selo.id) THEN
      CONTINUE;
    END IF;
    _val := COALESCE((_stats ->> _selo.condicao_campo)::numeric, 0);
    IF _val >= _selo.condicao_valor THEN
      INSERT INTO public.usuario_selos (user_id, selo_id) VALUES (_user_id, _selo.id) ON CONFLICT DO NOTHING;
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (_user_id, _selo.icone_emoji || ' Novo selo: ' || _selo.nome,
        'Você conquistou o selo ' || _selo.nome || '!', '/jogador/perfil');
    END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.check_selos(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_desafios(_user_id uuid, _acao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _d public.desafios%ROWTYPE;
  _periodo text;
  _prog int;
  _saldo int;
BEGIN
  _periodo := to_char(now(), 'IYYY-"W"IW');
  FOR _d IN SELECT * FROM public.desafios WHERE ativo AND acao_alvo = _acao LOOP
    INSERT INTO public.desafios_progresso (user_id, desafio_id, progresso_atual, periodo_referencia)
    VALUES (_user_id, _d.id, 1, _periodo)
    ON CONFLICT (user_id, desafio_id, periodo_referencia)
    DO UPDATE SET progresso_atual = public.desafios_progresso.progresso_atual + 1
    RETURNING progresso_atual INTO _prog;
    IF _prog >= _d.quantidade_alvo THEN
      UPDATE public.desafios_progresso SET concluido = true, concluido_em = now()
        WHERE user_id = _user_id AND desafio_id = _d.id AND periodo_referencia = _periodo AND NOT concluido;
      IF FOUND THEN
        UPDATE public.profiles SET pontos_total = pontos_total + _d.pontos_recompensa WHERE user_id = _user_id RETURNING pontos_total INTO _saldo;
        INSERT INTO public.pontos_historico (user_id, acao, valor_pontos, saldo_apos, descricao_legivel)
        VALUES (_user_id, 'desafio_completo', _d.pontos_recompensa, _saldo, 'Desafio: ' || _d.titulo);
        INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
        VALUES (_user_id, '🏆 Desafio concluído!', 'Você completou: ' || _d.titulo, '/jogador');
      END IF;
    END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.atualizar_desafios(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.atualizar_ofensiva(_user_id uuid, _data date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _o public.ofensivas%ROWTYPE;
  _nova int;
  _marcos int[] := ARRAY[5,10,20,50];
  _m int;
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
      VALUES (_user_id, '💔 Ofensiva resetada', 'Sua ofensiva foi resetada. Volte a jogar para reconstruir!', '/jogador');
    ELSE
      _nova := _o.sequencia_atual + 1;
    END IF;
    UPDATE public.ofensivas SET sequencia_atual = _nova,
      maior_sequencia = greatest(_o.maior_sequencia, _nova),
      ultima_pelada_em = _data, atualizado_em = now()
      WHERE user_id = _user_id;
  END IF;
  FOREACH _m IN ARRAY _marcos LOOP
    IF _nova = _m THEN PERFORM public.creditar_pontos(_user_id, 'ofensiva_' || _m::text, NULL); END IF;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.atualizar_ofensiva(uuid, date) FROM PUBLIC, anon, authenticated;

-- ====== TRIGGERS ======

CREATE OR REPLACE FUNCTION public.trg_confirmacao_pontos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'confirmado') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'confirmado' AND OLD.status <> 'confirmado') THEN
    PERFORM public.creditar_pontos(NEW.user_id, 'confirmou_presenca', NEW.pelada_id);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelado_tarde' AND OLD.status <> 'cancelado_tarde' THEN
    PERFORM public.creditar_pontos(NEW.user_id, 'cancelou_tarde', NEW.pelada_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trg_confirmacao_pontos() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_confirmacao_pontos_ins AFTER INSERT ON public.pelada_confirmacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_confirmacao_pontos();
CREATE TRIGGER trg_confirmacao_pontos_upd AFTER UPDATE ON public.pelada_confirmacoes
FOR EACH ROW EXECUTE FUNCTION public.trg_confirmacao_pontos();

CREATE OR REPLACE FUNCTION public.trg_lance_pontos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'gol' THEN PERFORM public.creditar_pontos(NEW.user_id, 'marcou_gol', NEW.pelada_id);
  ELSIF NEW.tipo = 'passe_decisivo' THEN PERFORM public.creditar_pontos(NEW.user_id, 'deu_passe_decisivo', NEW.pelada_id);
  ELSIF NEW.tipo = 'defesa' THEN PERFORM public.creditar_pontos(NEW.user_id, 'fez_defesa', NEW.pelada_id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trg_lance_pontos() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_lance_pontos AFTER INSERT ON public.lances FOR EACH ROW EXECUTE FUNCTION public.trg_lance_pontos();

CREATE OR REPLACE FUNCTION public.trg_partida_encerrada_pontos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid; _pel public.peladas%ROWTYPE;
BEGIN
  IF NEW.status = 'encerrada' AND OLD.status <> 'encerrada' THEN
    SELECT * INTO _pel FROM public.peladas WHERE id = NEW.pelada_id;
    FOR _u IN SELECT DISTINCT user_id FROM public.time_jogadores
      WHERE pelada_id = NEW.pelada_id AND time_id IN (NEW.time_a_id, NEW.time_b_id) LOOP
      PERFORM public.creditar_pontos(_u, 'jogou_pelada', NEW.pelada_id);
      PERFORM public.atualizar_ofensiva(_u, _pel.data);
    END LOOP;
    FOR _u IN SELECT user_id FROM public.auxiliares_partida WHERE partida_id = NEW.id LOOP
      PERFORM public.creditar_pontos(_u, 'foi_auxiliar', NEW.pelada_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trg_partida_encerrada_pontos() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_partida_encerrada_pontos AFTER UPDATE ON public.partidas
FOR EACH ROW EXECUTE FUNCTION public.trg_partida_encerrada_pontos();

-- ====== SEEDS ======
INSERT INTO public.pontos_config (acao, descricao, valor_pontos, multiplicador_capitao) VALUES
('confirmou_presenca','Confirmou presença em pelada',10,2.0),
('jogou_pelada','Participou de uma pelada',20,2.0),
('marcou_gol','Marcou um gol',15,2.0),
('deu_passe_decisivo','Deu passe decisivo',10,2.0),
('fez_defesa','Fez defesa importante',12,2.0),
('foi_auxiliar','Atuou como auxiliar',25,2.0),
('avaliou_jogadores','Avaliou jogadores após pelada',8,2.0),
('primeira_avaliacao','Avaliou jogadores pela primeira vez',20,2.0),
('indicou_jogador','Indicou jogador que participou de pelada',30,2.0),
('cancelou_tarde','Cancelou presença após sorteio',-25,1.0),
('ofensiva_5','Manteve ofensiva de 5 peladas',50,2.0),
('ofensiva_10','Manteve ofensiva de 10 peladas',120,2.0),
('ofensiva_20','Manteve ofensiva de 20 peladas',300,2.0),
('ofensiva_50','Manteve ofensiva de 50 peladas',1000,2.0),
('desafio_completo','Completou desafio semanal',40,2.0)
ON CONFLICT (acao) DO NOTHING;

INSERT INTO public.selos (codigo, nome, icone_emoji, categoria, condicao_campo, condicao_valor, descricao) VALUES
('artilheiro_raiz','Artilheiro Raiz','⚽','habilidade','gols_total',10,'10 gols marcados'),
('garcom','Garçom','🤝','habilidade','passes_total',10,'10 passes decisivos'),
('muralha','Muralha','🧤','habilidade','defesas_total',15,'15 defesas importantes'),
('fair_play','Fair Play','🏅','comportamento','media_avaliacao_comportamento',4.5,'Média 4.5+ em comportamento'),
('frangueiro','Frangueiro','🐔','comportamento','media_avaliacao_geral',2.0,'Avaliação baixa'),
('fantasma','Fantasma','👻','comportamento','cancelamentos_tarde',3,'3 cancelamentos tarde'),
('calouro','Calouro','🥉','progressao','pontos_total',0,'Bem-vindo ao Futzone'),
('peladeiro','Peladeiro','🥈','progressao','pontos_total',500,'500 pontos'),
('craque','Craque','🥇','progressao','pontos_total',2000,'2000 pontos'),
('lendario','Lendário','💎','progressao','pontos_total',8000,'8000 pontos'),
('recrutador','Recrutador','📣','engajamento','indicacoes_total',5,'5 indicações'),
('em_chamas','Em Chamas','🔥','engajamento','ofensiva_atual',10,'Ofensiva de 10 peladas'),
('auxiliar_fiel','Auxiliar Fiel','🗂️','engajamento','auxiliar_total',10,'10 atuações como auxiliar')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.desafios (titulo, descricao, tipo, acao_alvo, quantidade_alvo, pontos_recompensa) VALUES
('Presença Garantida','Participe de 2 peladas essa semana','semanal','jogou_pelada',2,40),
('Avaliador Fiel','Avalie os jogadores após cada pelada essa semana','semanal','avaliou_jogadores',2,30),
('Artilheiro da Semana','Marque 3 gols essa semana','semanal','marcou_gol',3,50)
ON CONFLICT DO NOTHING;

-- garantir selo Calouro a todos profiles existentes
INSERT INTO public.usuario_selos (user_id, selo_id)
SELECT p.user_id, s.id FROM public.profiles p CROSS JOIN public.selos s
WHERE s.codigo = 'calouro'
ON CONFLICT DO NOTHING;
