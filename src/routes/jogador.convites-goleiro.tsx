import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MapPin, Calendar, Clock, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/jogador/convites-goleiro")({ component: Wrapper });

function Wrapper() {
  const { user } = useAuth();
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <MobileShell items={getNavItems(user?.role)}><ConvitesGoleiro /></MobileShell>
    </RequireAuth>
  );
}

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  pendente: { label: "Aguardando resposta", cor: "text-yellow-500" },
  aceito: { label: "Aceito", cor: "text-green-500" },
  recusado: { label: "Recusado", cor: "text-red-500" },
};

function ConvitesGoleiro() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [convites, setConvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [respondendo, setRespondendo] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: perfil } = await (supabase as any).from("goleiros_perfil").select("id").eq("user_id", user.id).maybeSingle();
    if (!perfil) { setConvites([]); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from("goleiros_convites")
      .select("*, peladas(nome_pelada, local_nome)")
      .eq("goleiro_id", perfil.id)
      .order("criado_em", { ascending: false });
    setConvites(data || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  const aceitar = async (convite: any) => {
    setRespondendo(convite.id);
    const { error } = await (supabase as any).from("goleiros_convites").update({ status: "aceito" }).eq("id", convite.id);
    if (error) toast.error(error.message);
    else { toast.success("Convite aceito! Você já está confirmado na pelada."); void load(); }
    setRespondendo(null);
  };

  const recusar = async (convite: any) => {
    setRespondendo(convite.id);
    const { error } = await (supabase as any).from("goleiros_convites").update({ status: "recusado", motivo_recusa: motivo || null }).eq("id", convite.id);
    if (error) toast.error(error.message);
    else { toast.success("Convite recusado"); setRecusando(null); setMotivo(""); void load(); }
    setRespondendo(null);
  };

  const pendentes = convites.filter((c) => c.status === "pendente");
  const respondidos = convites.filter((c) => c.status !== "pendente");

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/jogador/perfil" })} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h2 className="text-xl font-bold">🧤 Convites de peladas</h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : convites.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">
          Você ainda não tem convites. Assim que aparecer no catálogo e algum capitão te chamar, o convite aparece aqui.
        </Card>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pendentes</h3>
              {pendentes.map((c) => (
                <Card key={c.id} className="p-4 space-y-2">
                  <div className="font-bold">{c.peladas?.nome_pelada || c.arena_nome || "Pelada"}</div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {c.data}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {c.horario_inicio?.slice(0,5)}–{c.horario_fim?.slice(0,5)}</span>
                    {c.arena_nome && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {c.arena_nome}</span>}
                  </div>
                  {c.valor_combinado && <div className="text-emerald-500 font-bold">R$ {Number(c.valor_combinado).toFixed(2)}</div>}
                  {c.mensagem && (
                    <div className="flex items-start gap-1.5 rounded-lg bg-secondary/40 p-2 text-sm">
                      <MessageCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>{c.mensagem}</span>
                    </div>
                  )}

                  {recusando === c.id ? (
                    <div className="space-y-2 pt-1">
                      <Textarea
                        placeholder="Motivo da recusa (opcional)"
                        maxLength={140}
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => { setRecusando(null); setMotivo(""); }}>Cancelar</Button>
                        <Button variant="destructive" className="flex-1" disabled={respondendo === c.id} onClick={() => recusar(c)}>
                          {respondendo === c.id ? "Enviando..." : "Confirmar recusa"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" className="flex-1" onClick={() => setRecusando(c.id)}>Recusar</Button>
                      <Button className="flex-1 bg-primary font-bold" disabled={respondendo === c.id} onClick={() => aceitar(c)}>
                        {respondendo === c.id ? "Aceitando..." : "Aceitar"}
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {respondidos.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Histórico</h3>
              {respondidos.map((c) => (
                <Card key={c.id} className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{c.peladas?.nome_pelada || c.arena_nome || "Pelada"}</div>
                    <div className="text-xs text-muted-foreground">{c.data} · {c.horario_inicio?.slice(0,5)}</div>
                  </div>
                  <span className={`text-xs font-bold ${STATUS_LABEL[c.status]?.cor || ""}`}>{STATUS_LABEL[c.status]?.label || c.status}</span>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
