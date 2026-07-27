import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Essa página existia antes como a tela do marketplace (preço, disponibilidade,
// convite). Unificamos tudo na página pública /goleiros/perfil/$userId — esse
// arquivo agora só existe pra não quebrar links antigos que apontem pra cá,
// redirecionando pra página nova assim que descobre o user_id do dono.
export const Route = createFileRoute("/goleiros/$id")({ component: RedirecionarParaPerfil });

function RedirecionarParaPerfil() {
  const { id } = useParams({ from: "/goleiros/$id" });
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("goleiros_perfil").select("user_id").eq("id", id).maybeSingle();
      if ((data as any)?.user_id) {
        navigate({ to: "/goleiros/perfil/$userId", params: { userId: (data as any).user_id }, replace: true });
      } else {
        navigate({ to: "/goleiros", replace: true });
      }
    })();
  }, [id]);

  return <div className="p-8 text-center text-sm text-muted-foreground">Redirecionando...</div>;
}
