import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { mediaSkill, mediaTime, corTextoLegivel, type Jogador } from "@/lib/sorteio";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowLeftRight, Shirt, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/peladas/$id/editar-times")({ component: Wrapper });

function Wrapper() {
  const { user } = useAuth();
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <MobileShell items={getNavItems(user?.role)}><EditarTimes /></MobileShell>
    </RequireAuth>
  );
}

type TimeUI = { id: string; nome: string; cor: string; membros: (Jogador & { eh_goleiro: boolean })[] };

function EditarTimes() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pelada, setPelada] = useState<any>(null);
  const [isCapitao, setIsCapitao] = useState(false);
  const [times, setTimes] = useState<TimeUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<{ user_id: string; nome: string; timeId: string } | null>(null);
  const [processando, setProcessando] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
    setPelada(p);
    if (!p) { setLoading(false); return; }
    const { data: m } = await supabase.from("grupo_membros").select("papel").eq("grupo_id", p.grupo_id).eq("user_id", user.id).eq("status", "ativo").maybeSingle();
    setIsCapitao(!!m && (m.papel === "capitao" || m.papel === "auxiliar"));

    const { data: tms } = await supabase.from("times").select("*").eq("pelada_id", id).order("ordem");
    const { data: tj } = await supabase.from("time_jogadores").select("*").eq("pelada_id", id);
    const uids = Array.from(new Set((tj || []).map((x: any) => x.user_id)));
    const { data: profs } = await supabase.from("profiles").select("user_id,nome").in("user_id", uids.length ? uids : ["00000000-0000-0000-0000-000000000000"]);
    const { data: convidados } = await supabase.from("pelada_convidados").select("id,nome").eq("pelada_id", id);
    const { data: skills } = await supabase.from("skills").select("user_id,velocidade,drible,passe,chute,resistencia,posicionamento").in("user_id", uids.length ? uids : ["00000000-0000-0000-0000-000000000000"]);

    const nomeMap: Record<string, string> = {};
    (profs || []).forEach((pf: any) => { nomeMap[pf.user_id] = pf.nome; });
    (convidados || []).forEach((c: any) => { nomeMap[c.id] = `${c.nome} (convidado)`; });
    const skMap: Record<string, any> = {};
    (skills || []).forEach((s: any) => { skMap[s.user_id] = s; });

    const ts: TimeUI[] = (tms || []).map((t: any) => ({
      id: t.id, nome: t.nome, cor: t.cor,
      membros: (tj || []).filter((x: any) => x.time_id === t.id).map((x: any) => ({
        user_id: x.user_id,
        nome: nomeMap[x.user_id] || "Jogador",
        media: mediaSkill(skMap[x.user_id]),
        eh_goleiro: !!x.eh_goleiro,
      })),
    }));
    setTimes(ts);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id, user?.id]);

  const trocar = async (jogadorB: { user_id: string; timeId: string }) => {
    if (!selecionado) return;
    setProcessando(true);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("time_jogadores").update({ time_id: jogadorB.timeId } as never).eq("pelada_id", id).eq("user_id", selecionado.user_id),
      supabase.from("time_jogadores").update({ time_id: selecionado.timeId } as never).eq("pelada_id", id).eq("user_id", jogadorB.user_id),
    ]);
    if (e1 || e2) toast.error((e1 || e2)?.message || "Erro ao trocar");
    else toast.success("Jogadores trocados de time!");
    setSelecionado(null);
    setProcessando(false);
    void load();
  };

  const mover = async (novoTimeId: string) => {
    if (!selecionado) return;
    setProcessando(true);
    const { error } = await supabase.from("time_jogadores").update({ time_id: novoTimeId } as never).eq("pelada_id", id).eq("user_id", selecionado.user_id);
    if (error) toast.error(error.message);
    else toast.success(`${selecionado.nome} movido!`);
    setSelecionado(null);
    setProcessando(false);
    void load();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!pelada) return <div className="text-sm text-muted-foreground">Pelada não encontrada.</div>;
  if (!isCapitao) return <div className="text-sm text-muted-foreground">Só o capitão pode editar os times.</div>;
  if (times.length === 0) return <div className="text-sm text-muted-foreground">Ainda não tem sorteio feito nessa pelada.</div>;
  if (pelada.status === "encerrada" || pelada.status === "cancelada") {
    return <div className="text-sm text-muted-foreground">Essa pelada já encerrou — não dá mais pra editar os times.</div>;
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/peladas/$id", params: { id } })} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div>
        <h2 className="text-xl font-bold">Editar times</h2>
        <p className="text-xs text-muted-foreground">Toque num jogador pra trocar de time com outro, ou mover ele sozinho.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {times.map((t) => {
          const goleiros = t.membros.filter((m) => m.eh_goleiro).length;
          return (
            <div key={t.id} className="rounded-xl border bg-card p-3" style={{ borderColor: t.cor }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-bold text-sm truncate" style={{ color: corTextoLegivel(t.cor) }}>
                  <div className="h-6 w-6 shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: t.cor }}>
                    <Shirt className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="truncate">{t.nome}</span>
                </div>
                <span className="text-xs font-bold shrink-0" style={{ color: corTextoLegivel(t.cor) }}>{mediaTime(t.membros).toFixed(1)}</span>
              </div>
              {goleiros === 0 && (
                <div className="mb-2 flex items-center gap-1 text-[10px] font-bold text-yellow-500"><AlertTriangle className="h-3 w-3" /> Sem goleiro</div>
              )}
              {goleiros > 1 && (
                <div className="mb-2 flex items-center gap-1 text-[10px] font-bold text-yellow-500"><AlertTriangle className="h-3 w-3" /> {goleiros} goleiros</div>
              )}
              <div className="space-y-1">
                {t.membros.map((m) => (
                  <button
                    key={m.user_id}
                    onClick={() => setSelecionado({ user_id: m.user_id, nome: m.nome, timeId: t.id })}
                    className="flex w-full items-center justify-between gap-1 rounded-lg bg-secondary/40 px-2 py-1.5 text-left text-xs hover:bg-secondary/70"
                  >
                    <span className="truncate">{m.eh_goleiro && "🧤 "}{m.nome}</span>
                    <ArrowLeftRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selecionado} onOpenChange={(v) => !v && setSelecionado(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>O que fazer com {selecionado?.nome}?</DialogTitle>
            <DialogDescription>Escolha trocar com outro jogador ou mover ele sozinho pra outro time.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Mover pra</div>
              <div className="flex flex-wrap gap-2">
                {times.filter((t) => t.id !== selecionado?.timeId).map((t) => (
                  <Button key={t.id} size="sm" variant="outline" disabled={processando} onClick={() => mover(t.id)}>
                    <div className="mr-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.cor }} />
                    {t.nome}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Trocar com</div>
              <div className="max-h-64 space-y-3 overflow-auto">
                {times.filter((t) => t.id !== selecionado?.timeId).map((t) => (
                  <div key={t.id}>
                    <div className="mb-1 text-[11px] font-bold" style={{ color: corTextoLegivel(t.cor) }}>{t.nome}</div>
                    <div className="space-y-1">
                      {t.membros.map((m) => (
                        <button
                          key={m.user_id}
                          disabled={processando}
                          onClick={() => trocar({ user_id: m.user_id, timeId: t.id })}
                          className="flex w-full items-center gap-1.5 rounded-lg bg-secondary/40 px-2 py-1.5 text-left text-xs hover:bg-secondary/70 disabled:opacity-50"
                        >
                          {m.eh_goleiro && "🧤 "}{m.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
