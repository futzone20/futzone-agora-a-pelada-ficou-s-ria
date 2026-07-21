CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'jogador'::public.app_role)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, public.profiles.nome),
    email = EXCLUDED.email;
  INSERT INTO public.skills (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.ofensivas (user_id, sequencia_atual, maior_sequencia) VALUES (NEW.id, 0, 0) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $fn$;

DO $$
DECLARE
  emails text[] := ARRAY['joao.silva@teste.com','pedro.santos@teste.com','carlos.oliveira@teste.com','lucas.souza@teste.com','marcos.pereira@teste.com','rafael.lima@teste.com','bruno.costa@teste.com','felipe.almeida@teste.com','gustavo.rodrigues@teste.com','thiago.ferreira@teste.com','andre.martins@teste.com','diego.gomes@teste.com','vinicius.ribeiro@teste.com','leandro.carvalho@teste.com','fernando.araujo@teste.com','rodrigo.melo@teste.com','eduardo.barbosa@teste.com','matheus.cardoso@teste.com','henrique.rocha@teste.com','daniel.dias@teste.com'];
  nomes text[] := ARRAY['João Silva','Pedro Santos','Carlos Oliveira','Lucas Souza','Marcos Pereira','Rafael Lima','Bruno Costa','Felipe Almeida','Gustavo Rodrigues','Thiago Ferreira','André Martins','Diego Gomes','Vinícius Ribeiro','Leandro Carvalho','Fernando Araújo','Rodrigo Melo','Eduardo Barbosa','Matheus Cardoso','Henrique Rocha','Daniel Dias'];
  i int;
  uid uuid;
BEGIN
  FOR i IN 1..array_length(emails,1) LOOP
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = emails[i]) THEN
      SELECT id INTO uid FROM auth.users WHERE email = emails[i];
    ELSE
      uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        emails[i], crypt('Teste@123', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nome', nomes[i], 'role', 'jogador'),
        now(), now(), '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', emails[i]), 'email', now(), now(), now());
    END IF;

    UPDATE public.profiles SET nome = nomes[i], email = emails[i],
      whatsapp = '11' || lpad((900000000 + i)::text, 9, '0'),
      cidade = 'São Paulo', estado = 'SP'
    WHERE user_id = uid;

    UPDATE public.skills SET
      velocidade = 2+(i%4), drible = 2+((i+1)%4), passe = 2+((i+2)%4),
      chute = 2+((i+3)%4), resistencia = 2+((i+4)%4), posicionamento = 2+((i+5)%4)
    WHERE user_id = uid;
  END LOOP;
END $$;