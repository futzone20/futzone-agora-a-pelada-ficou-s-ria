
CREATE OR REPLACE VIEW public.membros_completos
WITH (security_invoker = on) AS
SELECT 
  gm.id as membro_id,
  gm.grupo_id,
  gm.user_id,
  gm.papel,
  gm.status,
  gm.entrou_em,
  COALESCE(NULLIF(trim(p.nome), ''), split_part(p.email, '@', 1), 'Usuário') as nome,
  p.email,
  p.foto_url,
  p.cidade,
  p.estado,
  COALESCE(s.velocidade, 3)::numeric as velocidade,
  COALESCE(s.drible, 3)::numeric as drible,
  COALESCE(s.passe, 3)::numeric as passe,
  COALESCE(s.chute, 3)::numeric as chute,
  COALESCE(s.resistencia, 3)::numeric as resistencia,
  COALESCE(s.posicionamento, 3)::numeric as posicionamento,
  COALESCE(s.total_avaliacoes_recebidas, 0) as total_avaliacoes,
  COALESCE(s.peso_capitao_atual, 1.0) as peso_capitao,
  ROUND(((
    COALESCE(s.velocidade, 3) + COALESCE(s.drible, 3) + COALESCE(s.passe, 3) +
    COALESCE(s.chute, 3) + COALESCE(s.resistencia, 3) + COALESCE(s.posicionamento, 3)
  ) / 6.0)::numeric, 1) as nivel_geral
FROM public.grupo_membros gm
JOIN public.profiles p ON p.user_id = gm.user_id
LEFT JOIN public.skills s ON s.user_id = gm.user_id;

GRANT SELECT ON public.membros_completos TO authenticated;

CREATE OR REPLACE VIEW public.confirmacoes_completas
WITH (security_invoker = on) AS
SELECT
  pc.id as confirmacao_id,
  pc.pelada_id,
  pc.user_id,
  pc.status,
  pc.confirmado_em,
  COALESCE(NULLIF(trim(p.nome), ''), split_part(p.email, '@', 1), 'Usuário') as nome,
  p.email,
  p.foto_url,
  ROUND(((
    COALESCE(s.velocidade, 3) + COALESCE(s.drible, 3) + COALESCE(s.passe, 3) +
    COALESCE(s.chute, 3) + COALESCE(s.resistencia, 3) + COALESCE(s.posicionamento, 3)
  ) / 6.0)::numeric, 1) as nivel_geral,
  COALESCE(s.velocidade, 3)::numeric as velocidade,
  COALESCE(s.drible, 3)::numeric as drible,
  COALESCE(s.passe, 3)::numeric as passe,
  COALESCE(s.chute, 3)::numeric as chute,
  COALESCE(s.resistencia, 3)::numeric as resistencia,
  COALESCE(s.posicionamento, 3)::numeric as posicionamento
FROM public.pelada_confirmacoes pc
JOIN public.profiles p ON p.user_id = pc.user_id
LEFT JOIN public.skills s ON s.user_id = pc.user_id;

GRANT SELECT ON public.confirmacoes_completas TO authenticated;
