
-- Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS motivo_rebaixamento TEXT,
  ADD COLUMN IF NOT EXISTS rebaixado_em TIMESTAMPTZ;

-- capitao_status_log
CREATE TABLE IF NOT EXISTS public.capitao_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evento TEXT NOT NULL CHECK (evento IN ('aviso_inatividade','rebaixamento','reativacao')),
  motivo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.capitao_status_log TO authenticated;
GRANT ALL ON public.capitao_status_log TO service_role;
ALTER TABLE public.capitao_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario ve seu log" ON public.capitao_status_log
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Re-grant on existing helper functions
GRANT EXECUTE ON FUNCTION public.is_grupo_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_grupo_capitao(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.grupo_de_pelada(uuid) TO authenticated, anon;

-- verify_capitao_status: daily maintenance
CREATE OR REPLACE FUNCTION public.verify_capitao_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _u RECORD;
  _has_healthy BOOLEAN;
  _has_warn BOOLEAN;
  _last_pelada_days INT;
  _max_members INT;
BEGIN
  FOR _u IN SELECT user_id FROM public.profiles WHERE role = 'capitao' LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.grupo_membros gm
      JOIN public.grupos g ON g.id = gm.grupo_id
      WHERE gm.user_id = _u.user_id AND gm.papel = 'capitao' AND gm.status = 'ativo'
        AND (SELECT count(*) FROM public.grupo_membros m WHERE m.grupo_id = g.id AND m.status='ativo' AND m.user_id <> _u.user_id) >= 10
        AND EXISTS (SELECT 1 FROM public.peladas p WHERE p.grupo_id = g.id AND p.status='encerrada' AND p.data >= CURRENT_DATE - 60)
    ) INTO _has_healthy;

    IF _has_healthy THEN CONTINUE; END IF;

    -- has any group with 10+ members? (eligible for warning)
    SELECT EXISTS (
      SELECT 1 FROM public.grupo_membros gm
      JOIN public.grupos g ON g.id = gm.grupo_id
      WHERE gm.user_id = _u.user_id AND gm.papel='capitao' AND gm.status='ativo'
        AND (SELECT count(*) FROM public.grupo_membros m WHERE m.grupo_id=g.id AND m.status='ativo' AND m.user_id <> _u.user_id) >= 10
        AND COALESCE((SELECT EXTRACT(DAY FROM (now() - max(p.data)::timestamptz))::int FROM public.peladas p WHERE p.grupo_id=g.id AND p.status='encerrada'), 999) BETWEEN 30 AND 60
    ) INTO _has_warn;

    IF _has_warn THEN
      IF NOT EXISTS (SELECT 1 FROM public.capitao_status_log
                     WHERE user_id=_u.user_id AND evento='aviso_inatividade'
                       AND criado_em > now() - interval '7 days') THEN
        INSERT INTO public.capitao_status_log (user_id, evento, motivo)
        VALUES (_u.user_id, 'aviso_inatividade', 'Grupo inativo há mais de 30 dias');
        INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
        VALUES (_u.user_id, '⚠️ Atenção Capitão!',
          'Seu grupo está inativo. Realize uma pelada nos próximos 30 dias para manter seu status de Capitão.',
          '/capitao/grupos');
      END IF;
    ELSE
      UPDATE public.profiles
         SET role='jogador',
             motivo_rebaixamento='Grupo inativo por mais de 60 dias ou com menos de 10 jogadores',
             rebaixado_em=now()
       WHERE user_id=_u.user_id;
      INSERT INTO public.capitao_status_log (user_id, evento, motivo)
      VALUES (_u.user_id, 'rebaixamento', 'Grupo inativo por mais de 60 dias ou com menos de 10 membros');
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (_u.user_id, '📉 Status rebaixado',
        'Seu status de Capitão foi rebaixado para Jogador. Você mantém todos os pontos acumulados. Para voltar, crie um grupo com 10+ membros e realize peladas regularmente.',
        '/jogador/perfil');
    END IF;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.verify_capitao_status() TO service_role;

-- Reactivation: when a pelada is closed, check if creator should be re-promoted
CREATE OR REPLACE FUNCTION public.trg_check_reativacao_capitao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _u UUID; _membros INT; _role public.app_role;
BEGIN
  IF NEW.status='encerrada' AND OLD.status IS DISTINCT FROM 'encerrada' THEN
    SELECT user_id INTO _u FROM public.grupo_membros
     WHERE grupo_id=NEW.grupo_id AND papel='capitao' AND status='ativo' LIMIT 1;
    IF _u IS NULL THEN RETURN NEW; END IF;
    SELECT role INTO _role FROM public.profiles WHERE user_id=_u;
    IF _role <> 'jogador' THEN RETURN NEW; END IF;
    SELECT count(*) INTO _membros FROM public.grupo_membros
     WHERE grupo_id=NEW.grupo_id AND status='ativo' AND user_id <> _u;
    IF _membros >= 10 THEN
      UPDATE public.profiles SET role='capitao', motivo_rebaixamento=NULL, rebaixado_em=NULL WHERE user_id=_u;
      INSERT INTO public.capitao_status_log (user_id, evento, motivo)
      VALUES (_u, 'reativacao', 'Grupo voltou a ter 10+ membros e realizou pelada');
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      VALUES (_u, '👑 Bem-vindo de volta!',
        'Você recuperou o status de Capitão. Seus pontos em dobro estão de volta!',
        '/capitao');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pelada_reativacao_capitao ON public.peladas;
CREATE TRIGGER trg_pelada_reativacao_capitao
  AFTER UPDATE ON public.peladas
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_reativacao_capitao();

-- Schedule daily run at 03:00
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    PERFORM cron.unschedule('verify-capitao-status-daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='verify-capitao-status-daily');
    PERFORM cron.schedule('verify-capitao-status-daily', '0 3 * * *',
      $cron$ SELECT public.verify_capitao_status(); $cron$);
  END IF;
END $$;
