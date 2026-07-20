GRANT EXECUTE ON FUNCTION public.is_grupo_member(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_grupo_capitao(uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.grupo_de_pelada(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.media_skill_user(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_stats(uuid) TO authenticated, anon;