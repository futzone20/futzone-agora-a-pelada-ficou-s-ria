DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "publico ve profiles basico" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users view their own skills" ON public.skills;
DROP POLICY IF EXISTS "Capitao ve skills de membros" ON public.skills;
CREATE POLICY "skills_select_authenticated" ON public.skills FOR SELECT TO authenticated USING (true);