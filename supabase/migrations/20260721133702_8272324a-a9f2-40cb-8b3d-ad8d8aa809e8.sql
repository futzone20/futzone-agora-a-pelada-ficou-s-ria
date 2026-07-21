DO $$
DECLARE
  u_id uuid;
  emails text[] := ARRAY[
    'carlos.andrade@teste.com','rafael.mendes@teste.com','bruno.souza@teste.com',
    'diego.lima@teste.com','felipe.costa@teste.com','gustavo.alves@teste.com',
    'henrique.rocha@teste.com','igor.martins@teste.com','joao.pedro@teste.com',
    'lucas.ferreira@teste.com','mateus.gomes@teste.com','nicolas.barbosa@teste.com',
    'otavio.nunes@teste.com','pedro.henrique@teste.com','ricardo.silva@teste.com',
    'samuel.oliveira@teste.com','thiago.santos@teste.com','vinicius.castro@teste.com',
    'wesley.cardoso@teste.com','andre.moreira@teste.com'
  ];
  nomes text[] := ARRAY[
    'Carlos Andrade','Rafael Mendes','Bruno Souza','Diego Lima','Felipe Costa',
    'Gustavo Alves','Henrique Rocha','Igor Martins','João Pedro','Lucas Ferreira',
    'Mateus Gomes','Nicolas Barbosa','Otávio Nunes','Pedro Henrique','Ricardo Silva',
    'Samuel Oliveira','Thiago Santos','Vinícius Castro','Wesley Cardoso','André Moreira'
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(emails, 1) LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = emails[i]) THEN
      u_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, role, aud
      ) VALUES (
        u_id,
        '00000000-0000-0000-0000-000000000000',
        emails[i],
        crypt('Teste@123', gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nome', nomes[i], 'role', 'jogador'),
        false, 'authenticated', 'authenticated'
      );
    END IF;

    UPDATE public.profiles SET
      nome = nomes[i],
      cidade = 'Santos Dumont',
      estado = 'MG',
      whatsapp = '3299111' || lpad(i::text, 4, '0')
    WHERE email = emails[i];
  END LOOP;
END $$;

UPDATE public.skills SET velocidade=5, drible=4, passe=4, chute=5, resistencia=3, posicionamento=4 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='carlos.andrade@teste.com');
UPDATE public.skills SET velocidade=3, drible=4, passe=5, chute=3, resistencia=4, posicionamento=5 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='rafael.mendes@teste.com');
UPDATE public.skills SET velocidade=3, drible=2, passe=3, chute=4, resistencia=5, posicionamento=3 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='bruno.souza@teste.com');
UPDATE public.skills SET velocidade=4, drible=4, passe=3, chute=4, resistencia=4, posicionamento=4 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='diego.lima@teste.com');
UPDATE public.skills SET velocidade=4, drible=5, passe=4, chute=3, resistencia=3, posicionamento=4 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='felipe.costa@teste.com');
UPDATE public.skills SET velocidade=2, drible=3, passe=4, chute=2, resistencia=5, posicionamento=3 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='gustavo.alves@teste.com');
UPDATE public.skills SET velocidade=5, drible=4, passe=3, chute=5, resistencia=3, posicionamento=4 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='henrique.rocha@teste.com');
UPDATE public.skills SET velocidade=3, drible=3, passe=4, chute=4, resistencia=4, posicionamento=3 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='igor.martins@teste.com');
UPDATE public.skills SET velocidade=4, drible=5, passe=4, chute=4, resistencia=2, posicionamento=4 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='joao.pedro@teste.com');
UPDATE public.skills SET velocidade=3, drible=3, passe=2, chute=3, resistencia=4, posicionamento=2 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='lucas.ferreira@teste.com');
UPDATE public.skills SET velocidade=4, drible=3, passe=5, chute=3, resistencia=4, posicionamento=5 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='mateus.gomes@teste.com');
UPDATE public.skills SET velocidade=4, drible=4, passe=3, chute=5, resistencia=3, posicionamento=3 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='nicolas.barbosa@teste.com');
UPDATE public.skills SET velocidade=2, drible=4, passe=4, chute=2, resistencia=5, posicionamento=4 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='otavio.nunes@teste.com');
UPDATE public.skills SET velocidade=5, drible=2, passe=3, chute=4, resistencia=3, posicionamento=3 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='pedro.henrique@teste.com');
UPDATE public.skills SET velocidade=3, drible=4, passe=4, chute=4, resistencia=4, posicionamento=4 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='ricardo.silva@teste.com');
UPDATE public.skills SET velocidade=4, drible=4, passe=3, chute=3, resistencia=4, posicionamento=2 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='samuel.oliveira@teste.com');
UPDATE public.skills SET velocidade=4, drible=3, passe=4, chute=5, resistencia=2, posicionamento=5 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='thiago.santos@teste.com');
UPDATE public.skills SET velocidade=3, drible=5, passe=4, chute=2, resistencia=5, posicionamento=3 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='vinicius.castro@teste.com');
UPDATE public.skills SET velocidade=5, drible=3, passe=2, chute=4, resistencia=3, posicionamento=4 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='wesley.cardoso@teste.com');
UPDATE public.skills SET velocidade=3, drible=4, passe=5, chute=4, resistencia=4, posicionamento=3 WHERE user_id=(SELECT user_id FROM public.profiles WHERE email='andre.moreira@teste.com');