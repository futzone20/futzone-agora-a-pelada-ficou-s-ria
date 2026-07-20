import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Lock, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/agendamentos")({ component: AgPage });

function brl(n:number){return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

function AgPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroQuadra, setFiltroQuadra] = useState("todas");
  const [openBloq, setOpenBloq] = useState(false);
  const [bloq, setBloq] = useState<any>({ quadra_id:"", data:"", horario_inicio:"", horario_fim:"", motivo:"" });

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return;
    setArena(a);
    const { data: q } = await supabase.from("quadras").select("*").eq("arena_id", a.id);
    setQuadras(q ?? []);
    const { data: ag } = await supabase.from("agendamentos").select("*, quadras(nome), profiles!agendamentos_capitao_id_fkey(nome)").eq("arena_id", a.id).order("data", { ascending: false }).order("horario_inicio");
    setAgendamentos(ag ?? []);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("agendamentos").update({ status, atualizado_em: new Date().toISOString() } as never).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Atualizado"); void load(); }
  };

  const criarBloqueio = async () => {
    const { error } = await supabase.from("bloqueios_agenda").insert(bloq as never);
    if (error) toast.error(error.message); else { toast.success("Bloqueio criado"); setOpenBloq(false); setBloq({ quadra_id:"", data:"", horario_inicio:"", horario_fim:"", motivo:"" }); }
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  const filtrados = agendamentos.filter(a =>
    (filtroStatus === "todos" || a.status === filtroStatus) &&
    (filtroQuadra === "todas" || a.quadra_id === filtroQuadra)
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={filtroStatus} onValueChange={setFiltroStatus}><SelectTrigger className="flex-1"><SelectValue/></SelectTrigger><SelectContent>
          <SelectItem value="todos">Todos status</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="confirmado">Confirmado</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem><SelectItem value="concluido">Concluído</SelectItem>
        </SelectContent></Select>
        <Select value={filtroQuadra} onValueChange={setFiltroQuadra}><SelectTrigger className="flex-1"><SelectValue/></SelectTrigger><SelectContent>
          <SelectItem value="todas">Todas quadras</SelectItem>
          {quadras.map(q=><SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>)}
        </SelectContent></Select>
      </div>

      <Dialog open={openBloq} onOpenChange={setOpenBloq}>
        <DialogTrigger asChild><Button variant="outline" className="w-full"><Lock className="h-4 w-4 mr-1"/>Criar bloqueio</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Bloquear horário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Quadra</Label><Select value={bloq.quadra_id} onValueChange={v=>setBloq({...bloq,quadra_id:v})}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger><SelectContent>{quadras.map(q=><SelectItem key={q.id} value={q.id}>{q.nome}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Data</Label><Input type="date" value={bloq.data} onChange={e=>setBloq({...bloq,data:e.target.value})}/></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Início</Label><Input type="time" value={bloq.horario_inicio} onChange={e=>setBloq({...bloq,horario_inicio:e.target.value})}/></div>
              <div><Label>Fim</Label><Input type="time" value={bloq.horario_fim} onChange={e=>setBloq({...bloq,horario_fim:e.target.value})}/></div>
            </div>
            <div><Label>Motivo</Label><Input value={bloq.motivo} onChange={e=>setBloq({...bloq,motivo:e.target.value})}/></div>
            <Button onClick={criarBloqueio} className="w-full" disabled={!bloq.quadra_id||!bloq.data||!bloq.horario_inicio}><Plus className="h-4 w-4 mr-1"/>Bloquear</Button>
          </div>
        </DialogContent>
      </Dialog>

      {filtrados.map((a:any)=>(
        <Card key={a.id} className="p-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold">{a.data} · {a.horario_inicio?.slice(0,5)}–{a.horario_fim?.slice(0,5)}</div>
              <div className="text-xs text-muted-foreground">{a.quadras?.nome} · {a.profiles?.nome || "—"}</div>
              <div className="text-sm mt-1">{brl(Number(a.valor_cobrado||0))}</div>
            </div>
            <Badge variant={a.status==="confirmado"?"default":a.status==="cancelado"?"destructive":"outline"}>{a.status}</Badge>
          </div>
          {a.status === "pendente" && <div className="flex gap-2 mt-2"><Button size="sm" onClick={()=>updateStatus(a.id,"confirmado")}>Confirmar</Button><Button size="sm" variant="outline" onClick={()=>updateStatus(a.id,"cancelado")}>Cancelar</Button></div>}
          {a.status === "confirmado" && <Button size="sm" variant="outline" className="mt-2" onClick={()=>updateStatus(a.id,"concluido")}>Concluir</Button>}
        </Card>
      ))}
      {filtrados.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sem agendamentos.</p>}
    </div>
  );
}
