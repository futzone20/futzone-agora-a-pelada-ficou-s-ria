
-- ============ GOLEIROS ============
CREATE TABLE public.goleiros_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tipos_quadra TEXT[] NOT NULL DEFAULT ARRAY['society']::text[],
  valor_hora NUMERIC NOT NULL DEFAULT 0,
  bio TEXT,
  ativo_catalogo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goleiros_perfil TO authenticated;
GRANT SELECT ON public.goleiros_perfil TO anon;
GRANT ALL ON public.goleiros_perfil TO service_role;
ALTER TABLE public.goleiros_perfil ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Goleiros ativos visíveis" ON public.goleiros_perfil FOR SELECT USING (ativo_catalogo = true OR user_id = auth.uid());
CREATE POLICY "Goleiro gerencia próprio" ON public.goleiros_perfil FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.goleiros_disponibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goleiro_id UUID NOT NULL REFERENCES public.goleiros_perfil(id) ON DELETE CASCADE,
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goleiros_disponibilidade TO authenticated;
GRANT SELECT ON public.goleiros_disponibilidade TO anon;
GRANT ALL ON public.goleiros_disponibilidade TO service_role;
ALTER TABLE public.goleiros_disponibilidade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Disponibilidade visível" ON public.goleiros_disponibilidade FOR SELECT USING (true);
CREATE POLICY "Goleiro gerencia disponibilidade" ON public.goleiros_disponibilidade FOR ALL USING (
  EXISTS (SELECT 1 FROM public.goleiros_perfil g WHERE g.id = goleiro_id AND g.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.goleiros_perfil g WHERE g.id = goleiro_id AND g.user_id = auth.uid())
);

CREATE TABLE public.goleiros_bloqueios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goleiro_id UUID NOT NULL REFERENCES public.goleiros_perfil(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  motivo TEXT NOT NULL,
  origem_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goleiros_bloqueios TO authenticated;
GRANT SELECT ON public.goleiros_bloqueios TO anon;
GRANT ALL ON public.goleiros_bloqueios TO service_role;
ALTER TABLE public.goleiros_bloqueios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bloqueios visíveis" ON public.goleiros_bloqueios FOR SELECT USING (true);
CREATE POLICY "Goleiro gerencia bloqueios" ON public.goleiros_bloqueios FOR ALL USING (
  EXISTS (SELECT 1 FROM public.goleiros_perfil g WHERE g.id = goleiro_id AND g.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.goleiros_perfil g WHERE g.id = goleiro_id AND g.user_id = auth.uid())
);

CREATE TABLE public.goleiros_convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id UUID REFERENCES public.peladas(id) ON DELETE CASCADE,
  capitao_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goleiro_id UUID NOT NULL REFERENCES public.goleiros_perfil(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  arena_nome TEXT,
  valor_combinado NUMERIC,
  mensagem TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  motivo_recusa TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondido_em TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goleiros_convites TO authenticated;
GRANT ALL ON public.goleiros_convites TO service_role;
ALTER TABLE public.goleiros_convites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Convites visíveis aos envolvidos" ON public.goleiros_convites FOR SELECT USING (
  capitao_id = auth.uid() OR EXISTS (SELECT 1 FROM public.goleiros_perfil g WHERE g.id = goleiro_id AND g.user_id = auth.uid())
);
CREATE POLICY "Capitão cria convite" ON public.goleiros_convites FOR INSERT WITH CHECK (capitao_id = auth.uid());
CREATE POLICY "Envolvidos atualizam" ON public.goleiros_convites FOR UPDATE USING (
  capitao_id = auth.uid() OR EXISTS (SELECT 1 FROM public.goleiros_perfil g WHERE g.id = goleiro_id AND g.user_id = auth.uid())
);

CREATE TABLE public.goleiros_avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id UUID NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  avaliador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goleiro_id UUID NOT NULL REFERENCES public.goleiros_perfil(id) ON DELETE CASCADE,
  nota INT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pelada_id, avaliador_id, goleiro_id)
);
GRANT SELECT, INSERT ON public.goleiros_avaliacoes TO authenticated;
GRANT SELECT ON public.goleiros_avaliacoes TO anon;
GRANT ALL ON public.goleiros_avaliacoes TO service_role;
ALTER TABLE public.goleiros_avaliacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avaliações visíveis" ON public.goleiros_avaliacoes FOR SELECT USING (true);
CREATE POLICY "Avaliador insere" ON public.goleiros_avaliacoes FOR INSERT WITH CHECK (avaliador_id = auth.uid());

-- ============ PARCEIROS ============
CREATE TABLE public.parceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_estabelecimento TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  categoria TEXT NOT NULL DEFAULT 'outro',
  descricao TEXT,
  logo_url TEXT,
  foto_capa_url TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  google_maps_url TEXT,
  telefone TEXT,
  whatsapp TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  plano TEXT NOT NULL DEFAULT 'gratuito',
  plano_validade DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros TO authenticated;
GRANT SELECT ON public.parceiros TO anon;
GRANT ALL ON public.parceiros TO service_role;
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parceiros ativos visíveis" ON public.parceiros FOR SELECT USING (ativo = true OR user_id = auth.uid());
CREATE POLICY "Parceiro gerencia próprio" ON public.parceiros FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.parceiros_recompensas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parceiro_id UUID NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'produto',
  nome TEXT NOT NULL,
  descricao TEXT,
  regras TEXT,
  foto_url TEXT,
  valor_real NUMERIC NOT NULL DEFAULT 0,
  pontos_necessarios INT NOT NULL DEFAULT 0,
  quantidade_disponivel INT,
  quantidade_resgatada INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiros_recompensas TO authenticated;
GRANT SELECT ON public.parceiros_recompensas TO anon;
GRANT ALL ON public.parceiros_recompensas TO service_role;
ALTER TABLE public.parceiros_recompensas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recompensas visíveis" ON public.parceiros_recompensas FOR SELECT USING (true);
CREATE POLICY "Parceiro gerencia recompensas" ON public.parceiros_recompensas FOR ALL USING (
  EXISTS (SELECT 1 FROM public.parceiros p WHERE p.id = parceiro_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.parceiros p WHERE p.id = parceiro_id AND p.user_id = auth.uid())
);

CREATE TABLE public.parceiros_resgates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recompensa_id UUID NOT NULL REFERENCES public.parceiros_recompensas(id) ON DELETE CASCADE,
  parceiro_id UUID NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pontos_debitados INT NOT NULL,
  codigo_validacao TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pendente',
  solicitado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmado_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours')
);
GRANT SELECT, INSERT, UPDATE ON public.parceiros_resgates TO authenticated;
GRANT ALL ON public.parceiros_resgates TO service_role;
ALTER TABLE public.parceiros_resgates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Resgates visíveis aos envolvidos" ON public.parceiros_resgates FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.parceiros p WHERE p.id = parceiro_id AND p.user_id = auth.uid())
);
CREATE POLICY "Usuário cria resgate" ON public.parceiros_resgates FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Envolvidos atualizam" ON public.parceiros_resgates FOR UPDATE USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.parceiros p WHERE p.id = parceiro_id AND p.user_id = auth.uid())
);

CREATE TABLE public.parceiros_cliques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recompensa_id UUID NOT NULL REFERENCES public.parceiros_recompensas(id) ON DELETE CASCADE,
  parceiro_id UUID NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.parceiros_cliques TO authenticated;
GRANT INSERT ON public.parceiros_cliques TO anon;
GRANT ALL ON public.parceiros_cliques TO service_role;
ALTER TABLE public.parceiros_cliques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parceiro vê cliques" ON public.parceiros_cliques FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.parceiros p WHERE p.id = parceiro_id AND p.user_id = auth.uid())
);
CREATE POLICY "Cliques inserção pública" ON public.parceiros_cliques FOR INSERT WITH CHECK (true);

-- ============ FUNÇÕES ============
-- Slug parceiro
CREATE OR REPLACE FUNCTION public.handle_parceiro_slug()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _base TEXT; _slug TEXT; _try INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    _base := public.slugify(NEW.nome_estabelecimento);
    _slug := _base;
    WHILE EXISTS (SELECT 1 FROM public.parceiros WHERE slug = _slug AND id <> NEW.id) LOOP
      _try := _try + 1; _slug := _base || '-' || _try;
    END LOOP;
    NEW.slug := _slug;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_parceiro_slug BEFORE INSERT ON public.parceiros
  FOR EACH ROW EXECUTE FUNCTION public.handle_parceiro_slug();

-- Aceitar convite goleiro: cria bloqueio + notifica capitão
CREATE OR REPLACE FUNCTION public.handle_convite_goleiro_resposta()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _nome TEXT; _wpp TEXT;
BEGIN
  IF NEW.status = 'aceito' AND OLD.status <> 'aceito' THEN
    NEW.respondido_em := now();
    INSERT INTO public.goleiros_bloqueios (goleiro_id, data, horario_inicio, horario_fim, motivo, origem_id)
    VALUES (NEW.goleiro_id, NEW.data, NEW.horario_inicio, NEW.horario_fim, 'pelada_goleiro', NEW.pelada_id);
    SELECT p.nome, p.whatsapp INTO _nome, _wpp FROM public.goleiros_perfil g JOIN public.profiles p ON p.user_id = g.user_id WHERE g.id = NEW.goleiro_id;
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
    VALUES (NEW.capitao_id, '✅ Convite aceito',
      COALESCE(_nome,'Goleiro') || ' aceitou seu convite! Contato: ' || COALESCE(_wpp,'—'),
      '/capitao/peladas');
  ELSIF NEW.status = 'recusado' AND OLD.status <> 'recusado' THEN
    NEW.respondido_em := now();
    SELECT p.nome INTO _nome FROM public.goleiros_perfil g JOIN public.profiles p ON p.user_id = g.user_id WHERE g.id = NEW.goleiro_id;
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
    VALUES (NEW.capitao_id, '❌ Convite recusado',
      COALESCE(_nome,'Goleiro') || ' recusou o convite' || COALESCE(': ' || NEW.motivo_recusa, ''),
      '/capitao/peladas');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_convite_resposta BEFORE UPDATE ON public.goleiros_convites
  FOR EACH ROW EXECUTE FUNCTION public.handle_convite_goleiro_resposta();

-- Notificar goleiro ao receber convite
CREATE OR REPLACE FUNCTION public.handle_convite_goleiro_novo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _gu UUID;
BEGIN
  SELECT user_id INTO _gu FROM public.goleiros_perfil WHERE id = NEW.goleiro_id;
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
  VALUES (_gu, '🧤 Novo convite de jogo!',
    COALESCE(NEW.arena_nome,'Pelada') || ' — ' || NEW.data::text || ' às ' || NEW.horario_inicio::text ||
    COALESCE(' · R$ ' || NEW.valor_combinado::text, ''),
    '/jogador/perfil');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_convite_novo AFTER INSERT ON public.goleiros_convites
  FOR EACH ROW EXECUTE FUNCTION public.handle_convite_goleiro_novo();

-- Bloqueio automático quando goleiro confirma como jogador
CREATE OR REPLACE FUNCTION public.handle_goleiro_confirmacao_pelada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _g UUID; _pel public.peladas%ROWTYPE;
BEGIN
  SELECT id INTO _g FROM public.goleiros_perfil WHERE user_id = NEW.user_id AND ativo_catalogo = true;
  IF _g IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO _pel FROM public.peladas WHERE id = NEW.pelada_id;
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmado' THEN
    INSERT INTO public.goleiros_bloqueios (goleiro_id, data, horario_inicio, horario_fim, motivo, origem_id)
    VALUES (_g, _pel.data, _pel.horario_inicio, COALESCE(_pel.horario_fim, _pel.horario_inicio), 'pelada_jogador', NEW.pelada_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'confirmado' AND OLD.status <> 'confirmado' THEN
      INSERT INTO public.goleiros_bloqueios (goleiro_id, data, horario_inicio, horario_fim, motivo, origem_id)
      VALUES (_g, _pel.data, _pel.horario_inicio, COALESCE(_pel.horario_fim, _pel.horario_inicio), 'pelada_jogador', NEW.pelada_id);
    ELSIF OLD.status = 'confirmado' AND NEW.status <> 'confirmado' THEN
      DELETE FROM public.goleiros_bloqueios WHERE goleiro_id = _g AND origem_id = NEW.pelada_id AND motivo = 'pelada_jogador';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_goleiro_confirmacao AFTER INSERT OR UPDATE ON public.pelada_confirmacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_goleiro_confirmacao_pelada();

-- Resgate: gera código, debita pontos, valida saldo, incrementa contadores
CREATE OR REPLACE FUNCTION public.handle_resgate_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _saldo INT; _rec public.parceiros_recompensas%ROWTYPE; _nome TEXT; _po UUID;
BEGIN
  SELECT * INTO _rec FROM public.parceiros_recompensas WHERE id = NEW.recompensa_id FOR UPDATE;
  IF NOT _rec.ativo THEN RAISE EXCEPTION 'Recompensa inativa'; END IF;
  IF _rec.quantidade_disponivel IS NOT NULL AND _rec.quantidade_resgatada >= _rec.quantidade_disponivel THEN
    RAISE EXCEPTION 'Recompensa esgotada';
  END IF;
  SELECT pontos_total INTO _saldo FROM public.profiles WHERE user_id = NEW.user_id FOR UPDATE;
  IF COALESCE(_saldo,0) < _rec.pontos_necessarios THEN RAISE EXCEPTION 'Pontos insuficientes'; END IF;

  NEW.pontos_debitados := _rec.pontos_necessarios;
  NEW.parceiro_id := _rec.parceiro_id;
  IF NEW.codigo_validacao IS NULL OR NEW.codigo_validacao = '' THEN
    NEW.codigo_validacao := 'FZ-RESGATE-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 4));
  END IF;

  UPDATE public.profiles SET pontos_total = pontos_total - _rec.pontos_necessarios WHERE user_id = NEW.user_id RETURNING pontos_total INTO _saldo;
  INSERT INTO public.pontos_historico (user_id, acao, valor_pontos, saldo_apos, descricao_legivel)
  VALUES (NEW.user_id, 'resgate_parceiro', -_rec.pontos_necessarios, _saldo, 'Resgate: ' || _rec.nome);

  UPDATE public.parceiros_recompensas SET quantidade_resgatada = quantidade_resgatada + 1 WHERE id = _rec.id;

  SELECT nome INTO _nome FROM public.profiles WHERE user_id = NEW.user_id;
  SELECT user_id INTO _po FROM public.parceiros WHERE id = _rec.parceiro_id;
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
  VALUES (_po, '🎁 Novo resgate!',
    COALESCE(_nome,'Usuário') || ' quer resgatar ' || _rec.nome || '. Código: ' || NEW.codigo_validacao,
    '/parceiro/resgates');
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_resgate_insert BEFORE INSERT ON public.parceiros_resgates
  FOR EACH ROW EXECUTE FUNCTION public.handle_resgate_insert();

-- Cancelar/expirar resgate: estorna pontos
CREATE OR REPLACE FUNCTION public.handle_resgate_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _saldo INT; _rec_nome TEXT;
BEGIN
  IF NEW.status IN ('cancelado','expirado') AND OLD.status NOT IN ('cancelado','expirado') THEN
    UPDATE public.profiles SET pontos_total = pontos_total + NEW.pontos_debitados WHERE user_id = NEW.user_id RETURNING pontos_total INTO _saldo;
    SELECT nome INTO _rec_nome FROM public.parceiros_recompensas WHERE id = NEW.recompensa_id;
    INSERT INTO public.pontos_historico (user_id, acao, valor_pontos, saldo_apos, descricao_legivel)
    VALUES (NEW.user_id, 'estorno_resgate', NEW.pontos_debitados, COALESCE(_saldo,0), 'Estorno: ' || COALESCE(_rec_nome,'recompensa'));
    UPDATE public.parceiros_recompensas SET quantidade_resgatada = greatest(quantidade_resgatada - 1, 0) WHERE id = NEW.recompensa_id;
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
    VALUES (NEW.user_id, 'Resgate ' || NEW.status,
      'Seu resgate de ' || COALESCE(_rec_nome,'recompensa') || ' foi ' || NEW.status || '. Pontos estornados.',
      '/jogador/perfil');
  ELSIF NEW.status = 'confirmado' AND OLD.status <> 'confirmado' THEN
    NEW.confirmado_em := now();
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_resgate_update BEFORE UPDATE ON public.parceiros_resgates
  FOR EACH ROW EXECUTE FUNCTION public.handle_resgate_update();

-- Config pontos→reais
INSERT INTO public.pontos_config (acao, descricao, valor_pontos, ativo)
VALUES ('proporcao_pontos_reais', '400 pontos = R$ 1,00', 400, true)
ON CONFLICT (acao) DO NOTHING;
