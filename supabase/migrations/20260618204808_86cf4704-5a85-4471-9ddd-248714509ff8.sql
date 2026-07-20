
CREATE OR REPLACE FUNCTION public.media_skill_user(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((velocidade + drible + passe + chute + resistencia + posicionamento)::numeric / 6, 3)
  FROM public.skills WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.handle_substituicao_pos_sorteio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pelada public.peladas%ROWTYPE;
  _time_id uuid;
  _eh_goleiro boolean;
  _substituto uuid;
  _media_saiu numeric;
  _media_sub numeric;
  _diff numeric;
  _capitao uuid;
  _grupo uuid;
  _nome_saiu text;
  _nome_sub text;
  _nome_time text;
BEGIN
  IF NEW.status = 'cancelado_tarde' AND OLD.status <> 'cancelado_tarde' THEN
    SELECT * INTO _pelada FROM public.peladas WHERE id = NEW.pelada_id;
    IF NOT _pelada.sorteio_feito THEN RETURN NEW; END IF;

    SELECT time_id, eh_goleiro INTO _time_id, _eh_goleiro
      FROM public.time_jogadores WHERE pelada_id = NEW.pelada_id AND user_id = NEW.user_id;
    IF _time_id IS NULL THEN RETURN NEW; END IF;

    -- substituto: já promovido pelo trigger anterior, então pegar próximo confirmado fora dos times
    SELECT pc.user_id INTO _substituto
      FROM public.pelada_confirmacoes pc
      WHERE pc.pelada_id = NEW.pelada_id AND pc.status = 'confirmado'
        AND NOT EXISTS (SELECT 1 FROM public.time_jogadores tj WHERE tj.pelada_id = NEW.pelada_id AND tj.user_id = pc.user_id)
      ORDER BY pc.atualizado_em ASC NULLS LAST, pc.confirmado_em ASC LIMIT 1;

    _grupo := _pelada.grupo_id;
    SELECT user_id INTO _capitao FROM public.grupo_membros
      WHERE grupo_id = _grupo AND papel = 'capitao' AND status = 'ativo' LIMIT 1;
    SELECT nome INTO _nome_saiu FROM public.profiles WHERE user_id = NEW.user_id;
    SELECT nome INTO _nome_time FROM public.times WHERE id = _time_id;

    IF _substituto IS NULL THEN
      IF _capitao IS NOT NULL THEN
        INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
        VALUES (_capitao, 'Jogador cancelou',
          'Jogador ' || COALESCE(_nome_saiu,'—') || ' cancelou e não há substituto na lista de espera.',
          '/peladas/' || NEW.pelada_id::text);
      END IF;
      DELETE FROM public.time_jogadores WHERE pelada_id = NEW.pelada_id AND user_id = NEW.user_id;
      RETURN NEW;
    END IF;

    _media_saiu := public.media_skill_user(NEW.user_id);
    _media_sub := public.media_skill_user(_substituto);
    _diff := abs(_media_saiu - _media_sub);
    SELECT nome INTO _nome_sub FROM public.profiles WHERE user_id = _substituto;

    IF _diff <= 0.5 THEN
      UPDATE public.time_jogadores
         SET user_id = _substituto
       WHERE pelada_id = NEW.pelada_id AND user_id = NEW.user_id;
      INSERT INTO public.sorteio_log (pelada_id, realizado_por, tipo)
      VALUES (NEW.pelada_id, COALESCE(_capitao, NEW.user_id), 'ressorteiro_substituicao');
      INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
      SELECT tj.user_id, '🔄 Substituição',
        COALESCE(_nome_sub,'Novo jogador') || ' substituiu ' || COALESCE(_nome_saiu,'—') || ' no ' || COALESCE(_nome_time,'time') || '. Times mantidos!',
        '/peladas/' || NEW.pelada_id::text
      FROM public.time_jogadores tj WHERE tj.pelada_id = NEW.pelada_id;
    ELSE
      DELETE FROM public.time_jogadores WHERE pelada_id = NEW.pelada_id AND user_id = NEW.user_id;
      IF _capitao IS NOT NULL THEN
        INSERT INTO public.notificacoes (user_id, titulo, mensagem, link)
        VALUES (_capitao, '⚠️ Recomenda-se novo sorteio',
          'O substituto tem nível muito diferente do jogador que saiu. Recomendamos um novo sorteio.',
          '/peladas/' || NEW.pelada_id::text || '/sorteio');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_substituicao_pos_sorteio ON public.pelada_confirmacoes;
CREATE TRIGGER trg_substituicao_pos_sorteio
AFTER UPDATE ON public.pelada_confirmacoes
FOR EACH ROW EXECUTE FUNCTION public.handle_substituicao_pos_sorteio();
