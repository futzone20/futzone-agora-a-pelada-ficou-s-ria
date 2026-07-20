
-- Enums
CREATE TYPE public.papel_membro AS ENUM ('jogador', 'auxiliar', 'capitao');
CREATE TYPE public.status_membro AS ENUM ('ativo', 'removido');
CREATE TYPE public.tipo_superficie AS ENUM ('society', 'futsal', 'campo', 'outro');
CREATE TYPE public.sistema_disputa AS ENUM ('rodizio', 'mata_mata', 'pontos_corridos');
CREATE TYPE public.status_pelada AS ENUM ('aguardando', 'confirmada', 'em_andamento', 'encerrada', 'cancelada');
CREATE TYPE public.status_confirmacao AS ENUM ('confirmado', 'recusado', 'lista_espera', 'cancelado_tarde');

-- grupos
CREATE TABLE public.grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo_convite TEXT NOT NULL UNIQUE,
  permitir_membros_convidar BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos TO authenticated;
GRANT ALL ON public.grupos TO service_role;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

-- grupo_membros
CREATE TABLE public.grupo_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel public.papel_membro NOT NULL DEFAULT 'jogador',
  status public.status_membro NOT NULL DEFAULT 'ativo',
  entrou_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupo_membros TO authenticated;
GRANT ALL ON public.grupo_membros TO service_role;
ALTER TABLE public.grupo_membros ENABLE ROW LEVEL SECURITY;

-- quadras_publicas
CREATE TABLE public.quadras_publicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  tipo_superficie public.tipo_superficie NOT NULL DEFAULT 'society',
  capacidade_total INT,
  criada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  publica BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quadras_publicas TO authenticated;
GRANT ALL ON public.quadras_publicas TO service_role;
ALTER TABLE public.quadras_publicas ENABLE ROW LEVEL SECURITY;

-- peladas
CREATE TABLE public.peladas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  quadra_id UUID REFERENCES public.quadras_publicas(id) ON DELETE SET NULL,
  quadra_cliente_id UUID,
  nome_pelada TEXT NOT NULL,
  data DATE NOT NULL,
  horario_inicio TIME NOT NULL,
  horario_fim TIME NOT NULL,
  duracao_partida_minutos INT NOT NULL DEFAULT 10,
  numero_times INT NOT NULL DEFAULT 2 CHECK (numero_times >= 2),
  jogadores_por_time INT NOT NULL DEFAULT 5 CHECK (jogadores_por_time >= 1),
  goleiros_por_time INT NOT NULL DEFAULT 1 CHECK (goleiros_por_time >= 0),
  sistema_disputa public.sistema_disputa NOT NULL DEFAULT 'rodizio',
  status public.status_pelada NOT NULL DEFAULT 'aguardando',
  sorteio_feito BOOLEAN NOT NULL DEFAULT false,
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.peladas TO authenticated;
GRANT ALL ON public.peladas TO service_role;
ALTER TABLE public.peladas ENABLE ROW LEVEL SECURITY;

-- pelada_confirmacoes
CREATE TABLE public.pelada_confirmacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id UUID NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.status_confirmacao NOT NULL DEFAULT 'confirmado',
  confirmado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pelada_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pelada_confirmacoes TO authenticated;
GRANT ALL ON public.pelada_confirmacoes TO service_role;
ALTER TABLE public.pelada_confirmacoes ENABLE ROW LEVEL SECURITY;

-- notificacoes
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER, no privileges to client roles)
CREATE OR REPLACE FUNCTION public.is_grupo_member(_grupo_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.grupo_membros WHERE grupo_id = _grupo_id AND user_id = _user_id AND status = 'ativo');
$$;
REVOKE EXECUTE ON FUNCTION public.is_grupo_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_grupo_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_grupo_capitao(_grupo_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.grupo_membros WHERE grupo_id = _grupo_id AND user_id = _user_id AND status = 'ativo' AND papel IN ('capitao','auxiliar'));
$$;
REVOKE EXECUTE ON FUNCTION public.is_grupo_capitao(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_grupo_capitao(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.grupo_de_pelada(_pelada_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT grupo_id FROM public.peladas WHERE id = _pelada_id;
$$;
REVOKE EXECUTE ON FUNCTION public.grupo_de_pelada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grupo_de_pelada(uuid) TO authenticated;

-- RLS policies
-- grupos
CREATE POLICY "Membros veem seus grupos" ON public.grupos FOR SELECT TO authenticated
  USING (public.is_grupo_member(id, auth.uid()) OR criado_por = auth.uid());
CREATE POLICY "Usuários criam grupos" ON public.grupos FOR INSERT TO authenticated
  WITH CHECK (criado_por = auth.uid());
CREATE POLICY "Criador edita grupo" ON public.grupos FOR UPDATE TO authenticated
  USING (criado_por = auth.uid()) WITH CHECK (criado_por = auth.uid());
CREATE POLICY "Criador remove grupo" ON public.grupos FOR DELETE TO authenticated
  USING (criado_por = auth.uid());

-- grupo_membros
CREATE POLICY "Membros veem outros membros" ON public.grupo_membros FOR SELECT TO authenticated
  USING (public.is_grupo_member(grupo_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Usuário entra em grupo" ON public.grupo_membros FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_grupo_capitao(grupo_id, auth.uid()));
CREATE POLICY "Capitão atualiza membros" ON public.grupo_membros FOR UPDATE TO authenticated
  USING (public.is_grupo_capitao(grupo_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Capitão remove membros" ON public.grupo_membros FOR DELETE TO authenticated
  USING (public.is_grupo_capitao(grupo_id, auth.uid()) OR user_id = auth.uid());

-- quadras_publicas
CREATE POLICY "Todos veem quadras públicas" ON public.quadras_publicas FOR SELECT TO authenticated
  USING (publica = true OR criada_por = auth.uid());
CREATE POLICY "Usuário cadastra quadra" ON public.quadras_publicas FOR INSERT TO authenticated
  WITH CHECK (criada_por = auth.uid());
CREATE POLICY "Criador edita quadra" ON public.quadras_publicas FOR UPDATE TO authenticated
  USING (criada_por = auth.uid());

-- peladas
CREATE POLICY "Membros veem peladas" ON public.peladas FOR SELECT TO authenticated
  USING (public.is_grupo_member(grupo_id, auth.uid()));
CREATE POLICY "Capitão cria peladas" ON public.peladas FOR INSERT TO authenticated
  WITH CHECK (public.is_grupo_capitao(grupo_id, auth.uid()) AND criado_por = auth.uid());
CREATE POLICY "Capitão edita peladas" ON public.peladas FOR UPDATE TO authenticated
  USING (public.is_grupo_capitao(grupo_id, auth.uid()));
CREATE POLICY "Capitão remove peladas" ON public.peladas FOR DELETE TO authenticated
  USING (public.is_grupo_capitao(grupo_id, auth.uid()));

-- pelada_confirmacoes
CREATE POLICY "Membros veem confirmacoes" ON public.pelada_confirmacoes FOR SELECT TO authenticated
  USING (public.is_grupo_member(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "Usuário confirma presença" ON public.pelada_confirmacoes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_grupo_member(public.grupo_de_pelada(pelada_id), auth.uid()));
CREATE POLICY "Usuário atualiza própria confirmação" ON public.pelada_confirmacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Usuário remove própria confirmação" ON public.pelada_confirmacoes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- notificacoes
CREATE POLICY "Usuário vê suas notificações" ON public.notificacoes FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Sistema/usuário insere notificações" ON public.notificacoes FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Usuário atualiza suas notificações" ON public.notificacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Usuário remove suas notificações" ON public.notificacoes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Trigger: gerar codigo_convite + adicionar criador como capitão + promover role
CREATE OR REPLACE FUNCTION public.handle_new_grupo()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _code TEXT;
  _try INT := 0;
BEGIN
  IF NEW.codigo_convite IS NULL OR NEW.codigo_convite = '' THEN
    LOOP
      _code := 'FZ-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.grupos WHERE codigo_convite = _code);
      _try := _try + 1;
      IF _try > 10 THEN EXIT; END IF;
    END LOOP;
    NEW.codigo_convite := _code;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_grupo() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_grupos_before_insert BEFORE INSERT ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_grupo();

CREATE OR REPLACE FUNCTION public.handle_grupo_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Adiciona criador como capitão
  INSERT INTO public.grupo_membros (grupo_id, user_id, papel, status)
  VALUES (NEW.id, NEW.criado_por, 'capitao', 'ativo')
  ON CONFLICT (grupo_id, user_id) DO NOTHING;

  -- Promove jogador para capitao
  UPDATE public.profiles SET role = 'capitao'
   WHERE user_id = NEW.criado_por AND role = 'jogador';

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_grupo_created() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_grupos_after_insert AFTER INSERT ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.handle_grupo_created();

-- Trigger: capacidade da pelada (entrada e promoção)
CREATE OR REPLACE FUNCTION public.handle_confirmacao_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pelada public.peladas%ROWTYPE;
  _capacidade INT;
  _confirmados INT;
BEGIN
  IF NEW.status = 'confirmado' THEN
    SELECT * INTO _pelada FROM public.peladas WHERE id = NEW.pelada_id;
    _capacidade := (_pelada.jogadores_por_time + _pelada.goleiros_por_time) * _pelada.numero_times;
    SELECT count(*) INTO _confirmados FROM public.pelada_confirmacoes
      WHERE pelada_id = NEW.pelada_id AND status = 'confirmado';
    IF _confirmados >= _capacidade THEN
      NEW.status := 'lista_espera';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_confirmacao_insert() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_confirmacao_before_insert BEFORE INSERT ON public.pelada_confirmacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_confirmacao_insert();

CREATE OR REPLACE FUNCTION public.handle_confirmacao_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pelada public.peladas%ROWTYPE;
  _next_id UUID;
  _next_user UUID;
BEGIN
  NEW.atualizado_em := now();

  -- Se saiu de "confirmado" para qualquer outro, promover próximo da lista_espera
  IF OLD.status = 'confirmado' AND NEW.status <> 'confirmado' THEN
    SELECT * INTO _pelada FROM public.peladas WHERE id = NEW.pelada_id;
    SELECT id, user_id INTO _next_id, _next_user FROM public.pelada_confirmacoes
      WHERE pelada_id = NEW.pelada_id AND status = 'lista_espera'
      ORDER BY confirmado_em ASC LIMIT 1;
    IF _next_id IS NOT NULL THEN
      UPDATE public.pelada_confirmacoes
        SET status = 'confirmado', atualizado_em = now()
        WHERE id = _next_id;
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (_next_user, 'Você foi promovido!',
        'Uma vaga abriu em "' || _pelada.nome_pelada || '". Sua presença está confirmada.',
        '/jogador/peladas');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_confirmacao_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_confirmacao_before_update BEFORE UPDATE ON public.pelada_confirmacoes
  FOR EACH ROW EXECUTE FUNCTION public.handle_confirmacao_update();

-- Trigger: notificar membros ao criar pelada
CREATE OR REPLACE FUNCTION public.handle_new_pelada()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _grupo_nome TEXT;
BEGIN
  SELECT nome INTO _grupo_nome FROM public.grupos WHERE id = NEW.grupo_id;
  INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
  SELECT user_id,
         'Nova pelada criada',
         'Nova pelada criada: ' || NEW.nome_pelada || ' — ' || to_char(NEW.data, 'DD/MM') || ' às ' || to_char(NEW.horario_inicio, 'HH24:MI') || '. Confirme sua presença!',
         '/jogador/peladas'
  FROM public.grupo_membros
  WHERE grupo_id = NEW.grupo_id AND status = 'ativo' AND user_id <> NEW.criado_por;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_pelada() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_peladas_after_insert AFTER INSERT ON public.peladas
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_pelada();
