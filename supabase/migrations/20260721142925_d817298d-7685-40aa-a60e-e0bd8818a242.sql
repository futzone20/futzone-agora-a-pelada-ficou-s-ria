INSERT INTO public.profiles (user_id, nome, email, whatsapp, role, cidade, estado)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'nome', INITCAP(REPLACE(SPLIT_PART(u.email,'@',1),'.',' '))),
       u.email, '11900000000', 'jogador'::public.app_role, 'São Paulo', 'SP'
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE u.email LIKE '%@teste.com' AND p.user_id IS NULL;

INSERT INTO public.skills (user_id, velocidade, drible, passe, chute, resistencia, posicionamento)
SELECT u.id, 3,3,3,3,3,3 FROM auth.users u
LEFT JOIN public.skills s ON s.user_id = u.id
WHERE u.email LIKE '%@teste.com' AND s.user_id IS NULL;

INSERT INTO public.ofensivas (user_id, sequencia_atual, maior_sequencia)
SELECT u.id, 0, 0 FROM auth.users u
LEFT JOIN public.ofensivas o ON o.user_id = u.id
WHERE u.email LIKE '%@teste.com' AND o.user_id IS NULL;