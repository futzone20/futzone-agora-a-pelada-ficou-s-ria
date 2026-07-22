CREATE OR REPLACE FUNCTION public.trg_pelada_encerrada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'encerrada' AND OLD.status IS DISTINCT FROM 'encerrada' THEN
    NEW.avaliacao_aberta := true;
    NEW.avaliacao_fecha_em := now() + interval '24 hours';
    INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
    SELECT DISTINCT tj.user_id, '📋 A pelada acabou!',
      'Avalie os jogadores e vote no MVP da pelada.',
      '/peladas/' || NEW.id::text || '/avaliar'
    FROM public.time_jogadores tj
    WHERE tj.pelada_id = NEW.id
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = tj.user_id);
  END IF;
  RETURN NEW;
END; $$;