import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/convite/$codigo")({
  component: ConvitePage,
});

function ConvitePage() {
  const { codigo } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [grupo, setGrupo] = useState<{ id: string; nome: string; criado_por: string } | null>(null);
  const [capitao, setCapitao] = useState<string>("");
  const [ja, setJa] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.setItem("mrfut_invite", codigo);
  }, [codigo]);

  useEffect(() => {
    void (async () => {
      const { data: rows } = await (supabase as any).rpc("buscar_info_grupo", { _codigo: codigo } as never);
      const data = Array.isArray(rows) ? (rows as any[])[0] : rows;
      if (!data) return;
      setGrupo(data as any);
      const { data: prof } = await supabase.from("profiles").select("nome").eq("user_id", (data as any).criado_por).maybeSingle();
      setCapitao((prof as any)?.nome || "");
      if (user) {
        const { data: m } = await supabase.from("grupo_membros").select("id").eq("grupo_id", (data as any).id).eq("user_id", user.id).maybeSingle();
        setJa(!!m);
      }
    })();
  }, [codigo, user?.id]);

  const aceitar = async () => {
    if (!user || !grupo) return;
    setActing(true);
    const { error } = await supabase.from("grupo_membros").insert({
      grupo_id: grupo.id, user_id: user.id, papel: "jogador", status: "ativo",
    } as never);
    setActing(false);
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    if (typeof window !== "undefined") sessionStorage.removeItem("mrfut_invite");
    toast.success(`Bem-vindo ao ${grupo.nome}!`);
    navigate({ to: "/grupos/$id", params: { id: grupo.id } });
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Link to="/"><Logo className="text-2xl" /></Link></div>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><Shield className="h-7 w-7" /></div>
          {!grupo ? (
            <>
              <h1 className="text-lg font-bold">Convite inválido</h1>
              <p className="mt-1 text-sm text-muted-foreground">Este código não existe ou expirou.</p>
            </>
          ) : !user ? (
            <>
              <h1 className="text-lg font-bold">Você foi convidado!</h1>
              <p className="mt-1 text-sm text-muted-foreground">Para entrar no grupo <span className="text-foreground font-bold">{grupo.nome}</span>, faça login ou crie sua conta.</p>
              <div className="mt-6 flex flex-col gap-2">
                <Button asChild className="bg-primary text-primary-foreground font-bold hover:bg-primary/90"><Link to="/login">Entrar</Link></Button>
                <Button asChild variant="secondary"><Link to="/cadastro">Criar conta</Link></Button>
              </div>
            </>
          ) : ja ? (
            <>
              <h1 className="text-lg font-bold">Você já é membro</h1>
              <p className="mt-1 text-sm text-muted-foreground">Você já participa do {grupo.nome}.</p>
              <Button className="mt-6 w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90" onClick={() => navigate({ to: "/grupos/$id", params: { id: grupo.id } })}>Abrir grupo</Button>
            </>
          ) : (
            <>
              <h1 className="text-lg font-bold">{grupo.nome}</h1>
              {capitao && <p className="mt-1 text-sm text-muted-foreground">Capitão: <span className="text-foreground">{capitao}</span></p>}
              <Button onClick={aceitar} disabled={acting} className="mt-6 w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                {acting ? "Entrando..." : "Entrar no Grupo"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
