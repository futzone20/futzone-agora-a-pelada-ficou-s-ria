
-- ============ ARENAS ============
CREATE TABLE public.arenas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  cnpj_cpf TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  telefone TEXT,
  whatsapp TEXT,
  foto_capa_url TEXT,
  logo_url TEXT,
  horario_funcionamento JSONB DEFAULT '{}'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  plano TEXT NOT NULL DEFAULT 'gratuito',
  plano_validade DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arenas TO authenticated;
GRANT SELECT ON public.arenas TO anon;
GRANT ALL ON public.arenas TO service_role;
ALTER TABLE public.arenas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Arenas públicas ativas visíveis" ON public.arenas FOR SELECT USING (ativo = true OR user_id = auth.uid());
CREATE POLICY "Dono gerencia arena" ON public.arenas FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ QUADRAS ============
CREATE TABLE public.quadras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  slug TEXT NOT NULL,
  tipo_superficie TEXT NOT NULL DEFAULT 'society',
  jogadores_por_time INT NOT NULL DEFAULT 5,
  goleiros_por_time INT NOT NULL DEFAULT 1,
  duracao_partida_padrao INT NOT NULL DEFAULT 10,
  valor_padrao NUMERIC DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(arena_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quadras TO authenticated;
GRANT SELECT ON public.quadras TO anon;
GRANT ALL ON public.quadras TO service_role;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quadras visíveis a todos" ON public.quadras FOR SELECT USING (true);
CREATE POLICY "Dono gerencia quadras" ON public.quadras FOR ALL USING (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);

-- ============ AGENDAMENTOS ============
CREATE TABLE public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadra_id UUID NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE SET NULL,
  capitao_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  valor_cobrado NUMERIC DEFAULT 0,
  forma_pagamento TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Capitão vê seus agendamentos" ON public.agendamentos FOR SELECT USING (
  capitao_id = auth.uid() OR EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);
CREATE POLICY "Capitão cria agendamento" ON public.agendamentos FOR INSERT WITH CHECK (capitao_id = auth.uid());
CREATE POLICY "Dono ou capitão atualiza" ON public.agendamentos FOR UPDATE USING (
  capitao_id = auth.uid() OR EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);
CREATE POLICY "Dono ou capitão exclui" ON public.agendamentos FOR DELETE USING (
  capitao_id = auth.uid() OR EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);

-- ============ BLOQUEIOS ============
CREATE TABLE public.bloqueios_agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quadra_id UUID NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  motivo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bloqueios_agenda TO authenticated;
GRANT ALL ON public.bloqueios_agenda TO service_role;
ALTER TABLE public.bloqueios_agenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bloqueios visíveis" ON public.bloqueios_agenda FOR SELECT USING (true);
CREATE POLICY "Dono gerencia bloqueios" ON public.bloqueios_agenda FOR ALL USING (
  EXISTS (SELECT 1 FROM public.quadras q JOIN public.arenas a ON a.id = q.arena_id WHERE q.id = quadra_id AND a.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.quadras q JOIN public.arenas a ON a.id = q.arena_id WHERE q.id = quadra_id AND a.user_id = auth.uid())
);

-- ============ PDV CATEGORIAS ============
CREATE TABLE public.pdv_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo INT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(arena_id, codigo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_categorias TO authenticated;
GRANT ALL ON public.pdv_categorias TO service_role;
ALTER TABLE public.pdv_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia categorias" ON public.pdv_categorias FOR ALL USING (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);

-- ============ PDV PRODUTOS ============
CREATE TABLE public.pdv_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.pdv_categorias(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  codigo INT NOT NULL,
  foto_url TEXT,
  preco NUMERIC NOT NULL DEFAULT 0,
  estoque_atual INT NOT NULL DEFAULT 0,
  estoque_minimo INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(arena_id, codigo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_produtos TO authenticated;
GRANT ALL ON public.pdv_produtos TO service_role;
ALTER TABLE public.pdv_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia produtos" ON public.pdv_produtos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);

-- ============ PDV VENDAS ============
CREATE TABLE public.pdv_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total NUMERIC NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL,
  cashback_utilizado NUMERIC NOT NULL DEFAULT 0,
  operador_id UUID NOT NULL REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_vendas TO authenticated;
GRANT ALL ON public.pdv_vendas TO service_role;
ALTER TABLE public.pdv_vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono vê vendas" ON public.pdv_vendas FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);
CREATE POLICY "Dono cria vendas" ON public.pdv_vendas FOR INSERT WITH CHECK (
  operador_id = auth.uid() AND EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);

-- ============ PDV ITENS ============
CREATE TABLE public.pdv_itens_venda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES public.pdv_vendas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.pdv_produtos(id),
  quantidade INT NOT NULL,
  preco_unitario NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdv_itens_venda TO authenticated;
GRANT ALL ON public.pdv_itens_venda TO service_role;
ALTER TABLE public.pdv_itens_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Itens via venda" ON public.pdv_itens_venda FOR ALL USING (
  EXISTS (SELECT 1 FROM public.pdv_vendas v JOIN public.arenas a ON a.id = v.arena_id WHERE v.id = venda_id AND a.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.pdv_vendas v JOIN public.arenas a ON a.id = v.arena_id WHERE v.id = venda_id AND a.user_id = auth.uid())
);

-- ============ CASHBACK ============
CREATE TABLE public.cashback_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL UNIQUE REFERENCES public.arenas(id) ON DELETE CASCADE,
  percentual NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT false,
  validade_dias INT,
  aplicar_em TEXT NOT NULL DEFAULT 'ambos',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashback_config TO authenticated;
GRANT ALL ON public.cashback_config TO service_role;
ALTER TABLE public.cashback_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Config visível" ON public.cashback_config FOR SELECT USING (true);
CREATE POLICY "Dono gerencia config" ON public.cashback_config FOR ALL USING (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);

CREATE TABLE public.cashback_saldo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  saldo NUMERIC NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, arena_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashback_saldo TO authenticated;
GRANT ALL ON public.cashback_saldo TO service_role;
ALTER TABLE public.cashback_saldo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário vê seu saldo" ON public.cashback_saldo FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);

CREATE TABLE public.cashback_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  saldo_apos NUMERIC NOT NULL,
  origem TEXT NOT NULL,
  origem_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cashback_historico TO authenticated;
GRANT ALL ON public.cashback_historico TO service_role;
ALTER TABLE public.cashback_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Histórico visível ao usuário e dono" ON public.cashback_historico FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);

-- ============ FINANCEIRO ============
CREATE TABLE public.financeiro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID NOT NULL REFERENCES public.arenas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'manual',
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  categoria TEXT,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  origem_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated;
GRANT ALL ON public.financeiro_lancamentos TO service_role;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dono gerencia financeiro" ON public.financeiro_lancamentos FOR ALL USING (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.arenas a WHERE a.id = arena_id AND a.user_id = auth.uid())
);

-- ============ FUNÇÕES AUXILIARES ============
CREATE OR REPLACE FUNCTION public.slugify(_text TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' from regexp_replace(
    lower(translate(_text,
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- Slug auto para arena
CREATE OR REPLACE FUNCTION public.handle_arena_slug()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _base TEXT; _slug TEXT; _try INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    _base := public.slugify(NEW.nome);
    _slug := _base;
    WHILE EXISTS (SELECT 1 FROM public.arenas WHERE slug = _slug AND id <> NEW.id) LOOP
      _try := _try + 1;
      _slug := _base || '-' || _try;
    END LOOP;
    NEW.slug := _slug;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_arena_slug BEFORE INSERT ON public.arenas
  FOR EACH ROW EXECUTE FUNCTION public.handle_arena_slug();

-- Slug auto para quadra
CREATE OR REPLACE FUNCTION public.handle_quadra_slug()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _base TEXT; _slug TEXT; _try INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    _base := public.slugify(NEW.nome);
    _slug := _base;
    WHILE EXISTS (SELECT 1 FROM public.quadras WHERE slug = _slug AND arena_id = NEW.arena_id AND id <> NEW.id) LOOP
      _try := _try + 1;
      _slug := _base || '-' || _try;
    END LOOP;
    NEW.slug := _slug;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_quadra_slug BEFORE INSERT ON public.quadras
  FOR EACH ROW EXECUTE FUNCTION public.handle_quadra_slug();

-- Código automático de produto
CREATE OR REPLACE FUNCTION public.handle_produto_codigo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cat_codigo INT; _next INT;
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = 0 THEN
    SELECT codigo INTO _cat_codigo FROM public.pdv_categorias WHERE id = NEW.categoria_id;
    SELECT COALESCE(MAX(codigo), _cat_codigo * 100) + 1 INTO _next
      FROM public.pdv_produtos
      WHERE arena_id = NEW.arena_id AND codigo BETWEEN _cat_codigo * 100 AND (_cat_codigo + 1) * 100 - 1;
    IF _next < _cat_codigo * 100 + 1 THEN _next := _cat_codigo * 100 + 1; END IF;
    NEW.codigo := _next;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_produto_codigo BEFORE INSERT ON public.pdv_produtos
  FOR EACH ROW EXECUTE FUNCTION public.handle_produto_codigo();

-- Confirmação de agendamento → receita + cashback
CREATE OR REPLACE FUNCTION public.handle_agendamento_confirmado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cfg public.cashback_config%ROWTYPE; _credito NUMERIC; _saldo NUMERIC; _arena_nome TEXT;
BEGIN
  NEW.atualizado_em := now();
  IF NEW.status = 'confirmado' AND OLD.status <> 'confirmado' THEN
    INSERT INTO public.financeiro_lancamentos (arena_id, tipo, origem, descricao, valor, categoria, data_lancamento, origem_id)
    VALUES (NEW.arena_id, 'receita', 'agendamento',
      'Agendamento ' || NEW.data::text || ' ' || NEW.horario_inicio::text,
      COALESCE(NEW.valor_cobrado,0), 'agendamento', NEW.data, NEW.id);

    SELECT * INTO _cfg FROM public.cashback_config WHERE arena_id = NEW.arena_id AND ativo;
    IF FOUND AND _cfg.aplicar_em IN ('agendamento','ambos') AND COALESCE(NEW.valor_cobrado,0) > 0 THEN
      _credito := round((NEW.valor_cobrado * _cfg.percentual / 100)::numeric, 2);
      INSERT INTO public.cashback_saldo (user_id, arena_id, saldo) VALUES (NEW.capitao_id, NEW.arena_id, _credito)
        ON CONFLICT (user_id, arena_id) DO UPDATE SET saldo = public.cashback_saldo.saldo + EXCLUDED.saldo, atualizado_em = now()
        RETURNING saldo INTO _saldo;
      INSERT INTO public.cashback_historico (user_id, arena_id, tipo, valor, saldo_apos, origem, origem_id)
      VALUES (NEW.capitao_id, NEW.arena_id, 'credito', _credito, _saldo, 'agendamento', NEW.id);
      SELECT nome INTO _arena_nome FROM public.arenas WHERE id = NEW.arena_id;
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (NEW.capitao_id, '💰 Cashback!', 'Você ganhou R$ ' || _credito::text || ' de cashback na ' || _arena_nome, '/jogador');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_agendamento_confirmado BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_agendamento_confirmado();

-- Nova venda PDV: receita + estoque + cashback
CREATE OR REPLACE FUNCTION public.handle_venda_pdv()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cfg public.cashback_config%ROWTYPE; _credito NUMERIC; _saldo NUMERIC;
BEGIN
  INSERT INTO public.financeiro_lancamentos (arena_id, tipo, origem, descricao, valor, categoria, data_lancamento, origem_id)
  VALUES (NEW.arena_id, 'receita', 'pdv', 'Venda PDV', NEW.total, 'produto', CURRENT_DATE, NEW.id);

  IF NEW.forma_pagamento = 'cashback' AND NEW.usuario_id IS NOT NULL AND NEW.cashback_utilizado > 0 THEN
    UPDATE public.cashback_saldo SET saldo = saldo - NEW.cashback_utilizado, atualizado_em = now()
      WHERE user_id = NEW.usuario_id AND arena_id = NEW.arena_id RETURNING saldo INTO _saldo;
    INSERT INTO public.cashback_historico (user_id, arena_id, tipo, valor, saldo_apos, origem, origem_id)
    VALUES (NEW.usuario_id, NEW.arena_id, 'debito', NEW.cashback_utilizado, COALESCE(_saldo,0), 'pdv', NEW.id);
  END IF;

  IF NEW.usuario_id IS NOT NULL AND NEW.forma_pagamento <> 'cashback' THEN
    SELECT * INTO _cfg FROM public.cashback_config WHERE arena_id = NEW.arena_id AND ativo;
    IF FOUND AND _cfg.aplicar_em IN ('pdv','ambos') THEN
      _credito := round((NEW.total * _cfg.percentual / 100)::numeric, 2);
      IF _credito > 0 THEN
        INSERT INTO public.cashback_saldo (user_id, arena_id, saldo) VALUES (NEW.usuario_id, NEW.arena_id, _credito)
          ON CONFLICT (user_id, arena_id) DO UPDATE SET saldo = public.cashback_saldo.saldo + EXCLUDED.saldo, atualizado_em = now()
          RETURNING saldo INTO _saldo;
        INSERT INTO public.cashback_historico (user_id, arena_id, tipo, valor, saldo_apos, origem, origem_id)
        VALUES (NEW.usuario_id, NEW.arena_id, 'credito', _credito, _saldo, 'pdv', NEW.id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_venda_pdv AFTER INSERT ON public.pdv_vendas
  FOR EACH ROW EXECUTE FUNCTION public.handle_venda_pdv();

-- Decremento de estoque por item
CREATE OR REPLACE FUNCTION public.handle_item_venda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _atual INT;
BEGIN
  SELECT estoque_atual INTO _atual FROM public.pdv_produtos WHERE id = NEW.produto_id;
  IF _atual IS NULL OR _atual < NEW.quantidade THEN
    RAISE EXCEPTION 'Estoque insuficiente';
  END IF;
  UPDATE public.pdv_produtos SET estoque_atual = estoque_atual - NEW.quantidade WHERE id = NEW.produto_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_item_venda AFTER INSERT ON public.pdv_itens_venda
  FOR EACH ROW EXECUTE FUNCTION public.handle_item_venda();
