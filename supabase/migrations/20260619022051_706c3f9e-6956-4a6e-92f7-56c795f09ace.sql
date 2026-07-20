
-- 1) Tabela pelada_convidados
CREATE TABLE IF NOT EXISTS public.pelada_convidados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pelada_id UUID NOT NULL REFERENCES public.peladas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  posicao TEXT NOT NULL DEFAULT 'linha',
  nivel_geral NUMERIC NOT NULL DEFAULT 3.0,
  adicionado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pelada_convidados TO authenticated;
GRANT ALL ON public.pelada_convidados TO service_role;

ALTER TABLE public.pelada_convidados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros do grupo veem convidados"
  ON public.pelada_convidados FOR SELECT TO authenticated
  USING (public.is_grupo_member(public.grupo_de_pelada(pelada_id), auth.uid()));

CREATE POLICY "Capitao gerencia convidados"
  ON public.pelada_convidados FOR ALL TO authenticated
  USING (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()))
  WITH CHECK (public.is_grupo_capitao(public.grupo_de_pelada(pelada_id), auth.uid()));

-- 2) Policies do bucket avatars (privado)
CREATE POLICY "Avatars são públicos para leitura autenticada"
  ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'avatars');

CREATE POLICY "Usuário envia seu próprio avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Usuário atualiza seu próprio avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Usuário deleta seu próprio avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3) Garantir colunas extras no profiles (cidade, estado, peso, altura, posicao, bio, foto_url)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS peso NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS altura NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS posicao_preferida TEXT DEFAULT 'linha';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- 4) Seed dos 20 jogadores fictícios
DO $$
DECLARE
  _names text[] := ARRAY[
    'Carlos Andrade','Rafael Mendes','Bruno Souza','Diego Lima','Felipe Costa',
    'Gustavo Alves','Henrique Rocha','Igor Martins','João Pedro','Lucas Ferreira',
    'Mateus Gomes','Nicolas Barbosa','Otávio Nunes','Pedro Henrique','Ricardo Silva',
    'Samuel Oliveira','Thiago Santos','Vinícius Castro','Wesley Cardoso','André Moreira'
  ];
  _emails text[] := ARRAY[
    'carlos.andrade','rafael.mendes','bruno.souza','diego.lima','felipe.costa',
    'gustavo.alves','henrique.rocha','igor.martins','joao.pedro','lucas.ferreira',
    'mateus.gomes','nicolas.barbosa','otavio.nunes','pedro.henrique','ricardo.silva',
    'samuel.oliveira','thiago.santos','vinicius.castro','wesley.cardoso','andre.moreira'
  ];
  _uid uuid;
  _email text;
  _wpp text;
  _grupo uuid;
  i int;
BEGIN
  FOR i IN 1..20 LOOP
    _email := _emails[i] || '@teste.com';
    _wpp := '329911100' || lpad(i::text, 2, '0');

    SELECT id INTO _uid FROM auth.users WHERE email = _email;
    IF _uid IS NULL THEN
      _uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', _uid, 'authenticated', 'authenticated',
        _email, crypt('Teste@123', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nome', _names[i], 'whatsapp', _wpp, 'role', 'jogador'),
        now(), now(), '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), _uid,
        jsonb_build_object('sub', _uid::text, 'email', _email), 'email', _uid::text,
        now(), now(), now());
    END IF;

    INSERT INTO public.profiles (user_id, nome, email, whatsapp, cidade, estado, role)
    VALUES (_uid, _names[i], _email, _wpp, 'Juiz de Fora', 'MG', 'jogador')
    ON CONFLICT (user_id) DO UPDATE SET nome = EXCLUDED.nome, cidade='Juiz de Fora', estado='MG';

    INSERT INTO public.skills (user_id, velocidade, drible, passe, chute, resistencia, posicionamento, origem_ultima_atualizacao, total_avaliacoes_recebidas)
    VALUES (
      _uid,
      2 + floor(random()*4)::int,
      2 + floor(random()*4)::int,
      2 + floor(random()*4)::int,
      2 + floor(random()*4)::int,
      2 + floor(random()*4)::int,
      2 + floor(random()*4)::int,
      'capitao', 0
    )
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;

  -- Adicionar ao primeiro grupo ativo encontrado
  SELECT g.id INTO _grupo
  FROM public.grupos g
  JOIN public.grupo_membros gm ON gm.grupo_id = g.id AND gm.papel='capitao' AND gm.status='ativo'
  LIMIT 1;

  IF _grupo IS NOT NULL THEN
    FOR i IN 1..20 LOOP
      SELECT id INTO _uid FROM auth.users WHERE email = _emails[i] || '@teste.com';
      IF _uid IS NOT NULL THEN
        INSERT INTO public.grupo_membros (grupo_id, user_id, papel, status)
        VALUES (_grupo, _uid, 'jogador', 'ativo')
        ON CONFLICT (grupo_id, user_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END $$;
