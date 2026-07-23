import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, UserPlus, Users } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  peladaId: string;
  grupoId: string;
  capacidade: number;
}

const initials = (n: string) => n.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function GerenciarPresencasModal({ open, onOpenChange, peladaId, grupoId, capacidade }: Props) {
  const confirm = useConfirm();
  const [peladaStatus, setPeladaStatus] = useState<string | null>(null);
  
  const [membros, setMembros] = useState<any[]>([]);
  const [confirmacoes, setConfirmacoes] = useState<any[]>([]);
  const [convidados, setConvidados] = useState<any[]>([]);
  const [skillsMap, setSkillsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);

    const { data: pel } = await supabase.from("peladas").select("status, token_confirmacao").eq("id", peladaId).maybeSingle();
    setPeladaStatus((pel as any)?.status || null);
    setTokenConfirmacao((pel as any)?.token_confirmacao || null);


    const { data: gm } = await supabase
      .from("grupo_membros")
      .select("user_id, papel, status")
      .eq("grupo_id", grupoId)
      .eq("status", "ativo");

    const userIds = (gm || []).map((m: any) => m.user_id);
    const safeIds = userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"];

    const { data: profs } = await supabase
      .from("profiles")
      .select("user_id, nome, email, foto_url")
      .in("user_id", safeIds);

    const { data: sks } = await supabase
      .from("skills")
      .select("user_id, velocidade, drible, passe, chute, resistencia, posicionamento, total_avaliacoes_recebidas")
      .in("user_id", safeIds);

    const list = (gm || []).map((m: any) => {
      const p = (profs || []).find((x: any) => x.user_id === m.user_id);
      const s: any = (sks || []).find((x: any) => x.user_id === m.user_id);
      const v = s?.velocidade || 3, d = s?.drible || 3, pa = s?.passe || 3;
      const c = s?.chute || 3, r = s?.resistencia || 3, po = s?.posicionamento || 3;
      const nivel = Number(((v + d + pa + c + r + po) / 6).toFixed(1));
      const nome = p?.nome || p?.email?.split("@")[0] || "Usuário";
      return { user_id: m.user_id, nome, foto: p?.foto_url, papel: m.papel, nivel, skills: s };
    });

    setMembros(list);

    const skMap: Record<string, any> = {};
    list.forEach((m: any) => { skMap[m.user_id] = m; });
    setSkillsMap(skMap);

    const { data: confs } = await supabase.from("pelada_confirmacoes").select("*").eq("pelada_id", peladaId).order("confirmado_em");
    setConfirmacoes(confs || []);
    const { data: conv } = await supabase.from("pelada_convidados").select("*").eq("pelada_id", peladaId).order("criado_em");
    setConvidados(conv || []);

    setLoading(false);
  };


  useEffect(() => { if (open) void load(); }, [open, peladaId, grupoId]);

  const totalOcupado = confirmacoes.filter((c) => c.status === "confirmado").length + convidados.length;
  const vagasLivres = Math.max(0, capacidade - totalOcupado);
  const pct = Math.min(100, (totalOcupado / capacidade) * 100);
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-green-500";

  void skillsMap;



  const setStatus = async (userId: string, novoStatus: string) => {
    setActing(true);
    const existing = confirmacoes.find((c) => c.user_id === userId);
    let targetStatus = novoStatus;
    if (novoStatus === "confirmado" && vagasLivres <= 0 && existing?.status !== "confirmado") {
      targetStatus = "lista_espera";
      toast.warning("Pelada lotada. Jogador adicionado como reserva.");
    }
    if (existing) {
      const { error } = await supabase.from("pelada_confirmacoes").update({ status: targetStatus } as never).eq("id", existing.id);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.from("pelada_confirmacoes").insert({ pelada_id: peladaId, user_id: userId, status: targetStatus } as never);
      if (error) toast.error(error.message);
    }
    setActing(false);
    void load();
  };

  const encerrarListaManualmente = async () => {
    if (!(await confirm({
      title: "Encerrar lista agora",
      description: `A lista tem ${totalOcupado} de ${capacidade} vagas preenchidas. Encerrar agora com essa escalação parcial?`,
      confirmLabel: "Encerrar lista",
    }))) return;
    const { error } = await supabase.from("peladas").update({ status: "confirmada" } as never).eq("id", peladaId);
    if (error) return toast.error(error.message);
    toast.success("Lista encerrada! Já dá pra sortear os times.");
    void load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Gerenciar Presenças</DialogTitle></DialogHeader>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-bold">{totalOcupado} de {capacidade} vagas preenchidas</span>
            <span className="text-muted-foreground">{vagasLivres} livre{vagasLivres !== 1 ? "s" : ""}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          {peladaStatus === "aguardando" && (
            <Button size="sm" variant="outline" onClick={encerrarListaManualmente} className="w-full">
              Encerrar lista agora (mesmo incompleta)
            </Button>
          )}
          {tokenConfirmacao && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => {
                const link = `${window.location.origin}/pelada-confirmar/${tokenConfirmacao}`;
                navigator.clipboard.writeText(link);
                toast.success("Link de confirmação copiado! Só vale pra quem já está (ou vai entrar) no grupo.");
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar link de confirmação dessa pelada
            </Button>
          )}
        </div>


        {loading ? <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div> : (
        <Tabs defaultValue="escalacao">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="escalacao">Escalação</TabsTrigger>
            <TabsTrigger value="convidados">Convidados</TabsTrigger>
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
          </TabsList>

          <TabsContent value="escalacao" className="space-y-3 max-h-[50vh] overflow-y-auto">
            {(() => {
              const enriquecidos = membros.map((m) => {
                const c = confirmacoes.find((x) => x.user_id === m.user_id);
                return { ...m, st: c?.status as string | undefined };
              });
              const confirmados = enriquecidos.filter((m) => m.st === "confirmado");
              const reservasL = enriquecidos.filter((m) => m.st === "lista_espera");
              const pendentes = enriquecidos.filter((m) => !m.st || m.st === "recusado" || m.st === "cancelado_tarde");
              const renderRow = (m: any) => {
                const skill = m.nivel ?? 3;
                return (
                  <div key={m.user_id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                    <Avatar className="h-10 w-10">
                      {m.foto && <AvatarImage src={m.foto} />}
                      <AvatarFallback className="bg-secondary text-xs">{initials(m.nome)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{m.nome}</div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${(skill / 5) * 100}%` }} />
                        </div>
                        <span className="text-muted-foreground">{Number(skill).toFixed(1)}</span>
                      </div>
                    </div>
                    <StatusBadge status={m.st} />
                    <div className="flex gap-1">
                      {m.st === "confirmado" ? (
                        <Button size="sm" variant="outline" disabled={acting} onClick={() => setStatus(m.user_id, "recusado")} className="text-red-500 border-red-500/30">Remover</Button>
                      ) : m.st === "lista_espera" ? (
                        <Button size="sm" disabled={acting || vagasLivres <= 0} onClick={() => setStatus(m.user_id, "confirmado")} className="bg-yellow-500 hover:bg-yellow-600 text-black">Promover</Button>
                      ) : (
                        <Button size="sm" disabled={acting} onClick={() => setStatus(m.user_id, vagasLivres > 0 ? "confirmado" : "lista_espera")} className="bg-green-600 hover:bg-green-700 text-white">
                          {vagasLivres > 0 ? "Confirmar" : "Reserva"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              };
              return (
                <>
                  {confirmados.length > 0 && <div className="space-y-1"><div className="text-xs font-bold uppercase text-muted-foreground">✅ Confirmados ({confirmados.length})</div>{confirmados.map(renderRow)}</div>}
                  {pendentes.length > 0 && <div className="space-y-1"><div className="text-xs font-bold uppercase text-muted-foreground">⏱ Pendentes ({pendentes.length})</div>{pendentes.map(renderRow)}</div>}
                  {reservasL.length > 0 && <div className="space-y-1"><div className="text-xs font-bold uppercase text-muted-foreground">⏳ Reservas ({reservasL.length})</div>{reservasL.map(renderRow)}</div>}
                  {enriquecidos.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Nenhum membro encontrado no grupo.</div>}
                </>
              );
            })()}
          </TabsContent>


          <TabsContent value="convidados">
            <ConvidadosTab peladaId={peladaId} convidados={convidados} onChange={load} />
          </TabsContent>

          <TabsContent value="reservas" className="space-y-2">
            <ReservasTab confirmacoes={confirmacoes} membros={membros} vagasLivres={vagasLivres} acting={acting} onPromote={(uid: string) => setStatus(uid, "confirmado")} />
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "confirmado") return <Badge className="bg-green-600 text-white">✅ Confirmado</Badge>;
  if (status === "lista_espera") return <Badge className="bg-yellow-500 text-black">⏳ Reserva</Badge>;
  if (status === "recusado" || status === "cancelado_tarde") return <Badge variant="destructive">❌ Recusou</Badge>;
  return <Badge variant="secondary">— Pendente</Badge>;
}

function ConvidadosTab({ peladaId, convidados, onChange }: { peladaId: string; convidados: any[]; onChange: () => void }) {
  const [nome, setNome] = useState("");
  const [wpp, setWpp] = useState("");
  const [posicao, setPosicao] = useState<"linha" | "goleiro">("linha");
  const [nivel, setNivel] = useState(3);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!nome.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("pelada_convidados").insert({
      pelada_id: peladaId, nome: nome.trim(), whatsapp: wpp || null,
      posicao, nivel_geral: nivel, adicionado_por: u.user?.id,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Convidado adicionado");
    setNome(""); setWpp(""); setNivel(3); setPosicao("linha");
    onChange();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("pelada_convidados").delete().eq("id", id);
    if (error) toast.error(error.message);
    else onChange();
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="João Silva" /></div>
          <div><Label className="text-xs">WhatsApp</Label><Input value={wpp} onChange={(e) => setWpp(e.target.value)} placeholder="(00) 00000-0000" /></div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={posicao === "linha" ? "default" : "outline"} onClick={() => setPosicao("linha")}>⚽ Linha</Button>
          <Button size="sm" variant={posicao === "goleiro" ? "default" : "outline"} onClick={() => setPosicao("goleiro")}>🧤 Goleiro</Button>
        </div>
        <div>
          <Label className="text-xs">Nível: <span className="font-bold text-primary">{nivel}</span></Label>
          <Slider value={[nivel]} min={1} max={5} step={1} onValueChange={(v) => setNivel(v[0])} />
        </div>
        <Button onClick={add} disabled={saving} className="w-full bg-primary text-primary-foreground"><UserPlus className="mr-2 h-4 w-4" />Adicionar Convidado</Button>
      </div>
      <div className="space-y-1">
        {convidados.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum convidado ainda.</p> :
          convidados.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg bg-secondary/40 p-2">
              <div className="flex-1">
                <div className="text-sm font-bold">{c.nome} <Badge variant="outline" className="ml-1 text-[10px]">👤 Convidado</Badge></div>
                <div className="text-xs text-muted-foreground">{c.posicao === "goleiro" ? "🧤 Goleiro" : "⚽ Linha"} · Nível {c.nivel_geral}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><X className="h-4 w-4" /></Button>
            </div>
          ))
        }
      </div>
    </div>
  );
}

function ReservasTab({ confirmacoes, membros, vagasLivres, acting, onPromote }: any) {
  const reservas = confirmacoes
    .filter((c: any) => c.status === "lista_espera")
    .sort((a: any, b: any) => new Date(a.confirmado_em).getTime() - new Date(b.confirmado_em).getTime());
  if (reservas.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">⏳ Nenhum jogador na lista de reservas</div>;
  }
  return (
    <TooltipProvider>
      {reservas.map((c: any, i: number) => {
        const m = membros.find((x: any) => x.user_id === c.user_id);
        const nome = m?.nome || "Jogador";
        return (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
            <div className="h-8 w-8 flex items-center justify-center rounded-full bg-yellow-500/20 text-yellow-500 font-bold">{i + 1}</div>
            <Avatar className="h-8 w-8">
              {m?.foto && <AvatarImage src={m.foto} />}
              <AvatarFallback className="text-xs">{initials(nome)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-sm font-bold">{nome}</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span><Button size="sm" disabled={acting || vagasLivres <= 0} onClick={() => onPromote(c.user_id)} className="bg-green-600 hover:bg-green-700 text-white">Promover</Button></span>
              </TooltipTrigger>
              {vagasLivres <= 0 && <TooltipContent>Pelada lotada</TooltipContent>}
            </Tooltip>
          </div>
        );
      })}
    </TooltipProvider>
  );
}
