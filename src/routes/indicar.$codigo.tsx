import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/indicar/$codigo")({
  component: IndicarPage,
});

function IndicarPage() {
  const { codigo } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [indicadorNome, setIndicadorNome] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [invalido, setInvalido] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.setItem("mrfut_indicacao", codigo);
  }, [codigo]);

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any).rpc("buscar_indicacao_por_codigo", { _codigo: codigo });
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) { setInvalido(true); setCarregando(false); return; }
      setIndicadorNome(row.indicador_nome || null);
      setCarregando(false);
    })();
  }, [codigo]);

  useEffect(() => {
    if (!authLoading && user) {
      // Já logado: não faz sentido "se cadastrar" de novo. Manda pra home dele.
      if (typeof window !== "undefined") sessionStorage.removeItem("mrfut_indicacao");
      navigate({ to: "/jogador" });
    }
  }, [authLoading, user]);

  if (authLoading || carregando) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Link to="/"><Logo className="text-2xl" /></Link></div>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserPlus className="h-7 w-7" />
          </div>

          {invalido ? (
            <>
              <h1 className="text-lg font-bold">Link inválido</h1>
              <p className="mt-1 text-sm text-muted-foreground">Esse link de indicação não existe ou não está mais ativo.</p>
              <Button asChild className="mt-6 w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                <Link to="/cadastro">Criar conta mesmo assim</Link>
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold">
                {indicadorNome ? `${indicadorNome} te chamou pro MrFut! ⚽` : "Você foi indicado pro MrFut! ⚽"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Cria sua conta pra organizar peladas, entrar em grupos e subir no ranking.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild className="bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                  <Link to="/cadastro">Criar minha conta</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link to="/login">Já tenho conta</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
