
DROP POLICY "Sistema/usuário insere notificações" ON public.notificacoes;
CREATE POLICY "Usuário insere própria notificação" ON public.notificacoes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.is_grupo_member(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_grupo_capitao(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.grupo_de_pelada(uuid) FROM authenticated;
