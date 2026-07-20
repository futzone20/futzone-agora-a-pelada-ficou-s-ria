
-- ADS
CREATE TABLE public.ads_anunciantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  contato_nome TEXT,
  contato_email TEXT,
  contato_whatsapp TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_anunciantes TO authenticated;
GRANT ALL ON public.ads_anunciantes TO service_role;
ALTER TABLE public.ads_anunciantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_ads_anunciantes" ON public.ads_anunciantes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ads_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anunciante_id UUID NOT NULL REFERENCES public.ads_anunciantes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('banner','video','popup','patrocinio_pelada')),
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','ativa','pausada','encerrada')),
  segmentacao_tipo TEXT NOT NULL DEFAULT 'nacional' CHECK (segmentacao_tipo IN ('cidade','estado','regional','nacional')),
  segmentacao_valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  publico_alvo TEXT NOT NULL DEFAULT 'todos' CHECK (publico_alvo IN ('todos','jogadores','capitaes','donos_quadra')),
  telas TEXT[] NOT NULL DEFAULT '{}',
  frequencia_exibicao INT NOT NULL DEFAULT 5,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  grupos_alvo JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_campanhas TO authenticated;
GRANT ALL ON public.ads_campanhas TO service_role;
ALTER TABLE public.ads_campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_ads_campanhas_all" ON public.ads_campanhas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "users_read_ativas" ON public.ads_campanhas FOR SELECT TO authenticated
  USING (status = 'ativa');

CREATE TABLE public.ads_criativos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.ads_campanhas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('imagem','video','html')),
  url_arquivo TEXT NOT NULL,
  url_destino TEXT,
  largura INT,
  altura INT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads_criativos TO authenticated;
GRANT ALL ON public.ads_criativos TO service_role;
ALTER TABLE public.ads_criativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_ads_criativos_all" ON public.ads_criativos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "users_read_criativos" ON public.ads_criativos FOR SELECT TO authenticated
  USING (ativo = true);

CREATE TABLE public.ads_impressoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.ads_campanhas(id) ON DELETE CASCADE,
  criativo_id UUID REFERENCES public.ads_criativos(id) ON DELETE SET NULL,
  user_id UUID,
  cidade TEXT,
  estado TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ads_impressoes TO authenticated;
GRANT ALL ON public.ads_impressoes TO service_role;
ALTER TABLE public.ads_impressoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any_insert_impressoes" ON public.ads_impressoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_read_impressoes" ON public.ads_impressoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.ads_cliques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES public.ads_campanhas(id) ON DELETE CASCADE,
  criativo_id UUID REFERENCES public.ads_criativos(id) ON DELETE SET NULL,
  user_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ads_cliques TO authenticated;
GRANT ALL ON public.ads_cliques TO service_role;
ALTER TABLE public.ads_cliques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any_insert_cliques" ON public.ads_cliques FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin_read_cliques" ON public.ads_cliques FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ADMIN CONFIG
CREATE TABLE public.admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor TEXT NOT NULL,
  descricao TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_config TO authenticated;
GRANT ALL ON public.admin_config TO service_role;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_config_all" ON public.admin_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "users_read_config" ON public.admin_config FOR SELECT TO authenticated USING (true);

INSERT INTO public.admin_config (chave, valor, descricao) VALUES
  ('pontos_proporcao_reais','400','Pontos Futzone equivalentes a R$ 1,00'),
  ('sorteio_margem_skill','0.5','Margem de diferença de skill para substituição direta'),
  ('avaliacao_janela_horas','24','Horas disponíveis para avaliação pós-pelada'),
  ('cashback_validade_padrao','90','Dias de validade padrão do cashback'),
  ('resgate_expiracao_horas','48','Horas para expirar resgate não confirmado'),
  ('plano_jogador_preco','9.90','Preço mensal plano sem anúncios'),
  ('plano_quadra_preco','99.90','Preço mensal plano dono de quadra'),
  ('plano_parceiro_preco','49.90','Preço mensal plano parceiro fidelidade')
ON CONFLICT (chave) DO NOTHING;

-- ADMIN FINANCEIRO
CREATE TABLE public.admin_financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa')),
  origem TEXT NOT NULL CHECK (origem IN ('assinatura_jogador','assinatura_quadra','assinatura_parceiro','ads','manual')),
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL,
  user_id UUID,
  referencia_id UUID,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_financeiro TO authenticated;
GRANT ALL ON public.admin_financeiro TO service_role;
ALTER TABLE public.admin_financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_financeiro_all" ON public.admin_financeiro FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- STRIPE ASSINATURAS
CREATE TABLE public.stripe_assinaturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plano TEXT NOT NULL CHECK (plano IN ('jogador_premium','dono_quadra','parceiro')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('ativa','cancelada','inadimplente','trial')),
  periodo_inicio TIMESTAMPTZ,
  periodo_fim TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_assinaturas TO authenticated;
GRANT ALL ON public.stripe_assinaturas TO service_role;
ALTER TABLE public.stripe_assinaturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_read_own_sub" ON public.stripe_assinaturas FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin_manage_sub" ON public.stripe_assinaturas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- COMUNICAÇÕES
CREATE TABLE public.admin_comunicacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enviado_por UUID NOT NULL,
  publico TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT,
  quantidade_enviada INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_comunicacoes TO authenticated;
GRANT ALL ON public.admin_comunicacoes TO service_role;
ALTER TABLE public.admin_comunicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_comunicacoes_all" ON public.admin_comunicacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ADMIN ACTION LOG
CREATE TABLE public.admin_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  acao TEXT NOT NULL,
  alvo_tabela TEXT,
  alvo_id UUID,
  detalhes JSONB DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_log TO authenticated;
GRANT ALL ON public.admin_log TO service_role;
ALTER TABLE public.admin_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_log_all" ON public.admin_log FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Adicionar campos de status em profiles se ainda não existem
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','suspenso','banido')),
  ADD COLUMN IF NOT EXISTS motivo_suspensao TEXT,
  ADD COLUMN IF NOT EXISTS plano TEXT NOT NULL DEFAULT 'gratuito' CHECK (plano IN ('gratuito','premium')),
  ADD COLUMN IF NOT EXISTS plano_validade TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT;

-- Patrocínio de pelada: ao criar pelada, gerar post se houver campanha patrocinio_pelada elegível
CREATE OR REPLACE FUNCTION public.trg_pelada_patrocinio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _c RECORD; _an TEXT;
BEGIN
  FOR _c IN
    SELECT c.id, c.anunciante_id, a.nome AS anunciante_nome
    FROM public.ads_campanhas c
    JOIN public.ads_anunciantes a ON a.id = c.anunciante_id
    WHERE c.tipo='patrocinio_pelada' AND c.status='ativa'
      AND CURRENT_DATE BETWEEN c.data_inicio AND c.data_fim
    LIMIT 1
  LOOP
    PERFORM public.criar_feed_post(NEW.grupo_id, 'patrocinio', NEW.id, NULL,
      jsonb_build_object('anunciante', _c.anunciante_nome, 'pelada_nome', NEW.nome_pelada, 'campanha_id', _c.id));
  END LOOP;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_pelada_patrocinio ON public.peladas;
CREATE TRIGGER trg_pelada_patrocinio
AFTER INSERT ON public.peladas
FOR EACH ROW EXECUTE FUNCTION public.trg_pelada_patrocinio();
