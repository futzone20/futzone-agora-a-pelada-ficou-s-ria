import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/pelada-confirmar/$token")({
  component: PeladaConfirmarPage,
});

type PeladaInfo = {
  id: string; nome_pelada: string; data: string; horario_inicio: string;
  grupo_id: string; grupo_nome: string; capitao_nome: string;
};

function PeladaConfirmarPage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [pelada, setPelada] = useState<PeladaInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [membroStatus, setMembroStatus] = useState<"nao_membro" | "pendente" | "ativo" | null>(null);
  const [jaConfirmado, setJaConfirmado] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.setItem("mrfut_pelada_confirmacao", token);
  }, [token]);

  useEffect(() => {
    void (async () => {
      const { data: pel } = await supabase
        .from("peladas")
        .select("id, nome_pelada, data, horario_inicio, grupo_id")
        .eq("token_confirmacao" as never, token as never)
        .maybeSingle();
      if (!pel) { setCarregando(false); return; }

      const { data: grupoRows } = await (supabase as any).rpc("buscar_info_grupo", { _grupo_id: (pel as any).grupo_id } as never);
      const grupoData = Array.isArray(grupoRows) ? (grupoRows as any[])[0] : grupoRows;
      const { data: capProf } = grupoData
        ? await supabase.from("profiles").select("nome").eq("user_id", (grupoData as any).criado_por).maybeSingle()
        : { data: null };

      setPelada({
        id: (pel as any).id,
        nome_pelada: (pel as any).nome_pelada,
        data: (pel as any).data,
        horario_inicio: (pel as any).horario_inicio,
        grupo_id: (pel as any).grupo_id,
        grupo_nome: (grupoData as any)?.nome || "",
        capitao_nome: (capProf as any)?.nome || "",
      });
      setCarregando(false);

      if (user) {
        const { data: m } = await supabase.from("grupo_membros").select("status").eq("grupo_id", (pel as any).grupo_id).eq("user_id", user.id).maybeSingle();
        const status = (m as any)?.status;
        setMembroStatus(status === "ativo" ? "ativo" : status === "pendente" ? "pendente" : "nao_membro");
        if (status === "ativo") {
          const { data: conf } = await supabase.from("pelada_confirmacoes").select("status").eq("pelada_id", (pel as any).id).eq("user_id", user.id).maybeSingle();
          setJaConfirmado((conf as any)?.status === "confirmado");
        }
      }
    })();
  }, [token, user?.id]);

  const pedirEntrada = async () => {
    if (!user || !pelada) return;
    setActing(true);
    const { error } = await supabase.from("grupo_membros").insert({
      grupo_id: pelada.grupo_id, user_id: user.id, papel: "jogador", status: "pendente",
    } as never);
    setActing(false);
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);

    const { data: capitaes } = await supabase.from("grupo_membros").select("user_id").eq("grupo_id", pelada.grupo_id).eq("papel", "capitao").eq("status", "ativo");
    for (const cap of (capitaes as any[]) || []) {
      await supabase.from("notificacoes").insert({
        user_id: cap.user_id,
        titulo: "👋 Pedido pra entrar no grupo",
        mensagem: `${user.nome} quer entrar no grupo "${pelada.grupo_nome}" pra jogar "${pelada.nome_pelada}".`,
        tipo: "pedido_membro",
        link: `/grupos/${pelada.grupo_id}`,
      } as never);
    }
    toast.success("Pedido enviado! Assim que o capitão aceitar, sua presença é confirmada.");
    setMembroStatus("pendente");
  };

  const confirmarPresenca = async () => {
    if (!user || !pelada) return;
    setActing(true);
    const { data: existente } = await supabase.from("pelada_confirmacoes").select("id").eq("pelada_id", pelada.id).eq("user_id", user.id).maybeSingle();
    if (existente) {
      await supabase.from("pelada_confirmacoes").update({ status: "confirmado" } as never).eq("id", (existente as any).id);
    } else {
      await supabase.from("pelada_confirmacoes").insert({ pelada_id: pelada.id, user_id: user.id, status: "confirmado" } as never);
    }
    setActing(false);
    if (typeof window !== "undefined") sessionStorage.removeItem("mrfut_pelada_confirmacao");
    toast.success("Presença confirmada!");
    navigate({ to: "/peladas/$id", params: { id: pelada.id } });
  };

  if (authLoading || carregando) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Link to="/"><Logo className="text-2xl" /></Link></div>
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          {!pelada ? (
            <>
              <h1 className="text-xl font-bold">Link inválido</h1>
              <p className="text-sm text-muted-foreground">Esse link de confirmação não existe ou expirou.</p>
            </>
          ) : !user ? (
            <>
              <h1 className="text-xl font-bold">{pelada.nome_pelada}</h1>
              <p className="text-sm text-muted-foreground">
                Grupo <span className="font-bold text-foreground">{pelada.grupo_nome}</span>. Para confirmar presença, faça login ou crie sua conta.
              </p>
              <div className="flex gap-2 pt-2">
                <Button asChild className="flex-1 bg-primary text-primary-foreground font-bold hover:bg-primary/90"><Link to="/login">Entrar</Link></Button>
                <Button asChild variant="outline" className="flex-1"><Link to="/cadastro">Criar conta</Link></Button>
              </div>
            </>
          ) : membroStatus === "pendente" ? (
            <>
              <h1 className="text-xl font-bold">Pedido enviado</h1>
              <p className="text-sm text-muted-foreground">
                Assim que o capitão do <span className="font-bold text-foreground">{pelada.grupo_nome}</span> aceitar sua entrada, sua presença nessa pelada é confirmada automaticamente.
              </p>
            </>
          ) : membroStatus === "ativo" && jaConfirmado ? (
            <>
              <h1 className="text-xl font-bold">Você já confirmou! ✓</h1>
              <p className="text-sm text-muted-foreground">Sua presença em "{pelada.nome_pelada}" já está confirmada.</p>
              <Button className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90" onClick={() => navigate({ to: "/peladas/$id", params: { id: pelada.id } })}>
                Ver pelada
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold">{pelada.nome_pelada}</h1>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {pelada.data.split("-").reverse().join("/")}</p>
                <p className="inline-flex items-center gap-2"><Clock className="h-4 w-4" /> {pelada.horario_inicio.slice(0, 5)}</p>
                <p className="inline-flex items-center gap-2"><Shield className="h-4 w-4" /> {pelada.grupo_nome}</p>
              </div>
              {pelada.capitao_nome && <p className="text-xs text-muted-foreground">Capitão: {pelada.capitao_nome}</p>}

              {membroStatus === "ativo" ? (
                <Button onClick={confirmarPresenca} disabled={acting} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                  {acting ? "Confirmando..." : "Confirmar presença"}
                </Button>
              ) : (
                <>
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                    Você ainda não faz parte do grupo "{pelada.grupo_nome}". Peça entrada — o capitão precisa aceitar antes da sua presença valer.
                  </p>
                  <Button onClick={pedirEntrada} disabled={acting} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
                    {acting ? "Enviando..." : "Pedir entrada e confirmar presença"}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
