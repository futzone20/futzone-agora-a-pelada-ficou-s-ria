import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/goleiros/$id")({ component: GoleiroPage });

const DIAS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function GoleiroPage() {
  const { id } = useParams({ from: "/goleiros/$id" });
  const { user } = useAuth();
  const [g, setG] = useState<any>(null);
  const [disp, setDisp] = useState<any[]>([]);
  const [avs, setAvs] = useState<any[]>([]);
  const [peladas, setPeladas] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ pelada_id:"", data:"", horario_inicio:"", horario_fim:"", arena_nome:"", valor_combinado:"", mensagem:"" });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("goleiros_perfil").select("*, profiles!goleiros_perfil_user_id_fkey(nome, cidade, estado, foto_url, handle)").eq("id", id).maybeSingle();
      setG(data);
      const { data: d } = await supabase.from("goleiros_disponibilidade").select("*").eq("goleiro_id", id).order("dia_semana");
      setDisp(d ?? []);
      const { data: a } = await supabase.from("goleiros_avaliacoes").select("nota").eq("goleiro_id", id);
      setAvs(a ?? []);
    })();
  }, [id]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("peladas").select("id, nome_pelada, data, horario_inicio, horario_fim, local_nome").eq("criado_por", user.id).in("status", ["aguardando","confirmada"]).order("data", { ascending: false }).limit(20);
      setPeladas(data ?? []);
    })();
  }, [user?.id]);

  const selectPelada = (pid: string) => {
    const p = peladas.find(x=>x.id===pid); if (!p) return;
    setForm({ ...form, pelada_id: pid, data: p.data, horario_inicio: p.horario_inicio, horario_fim: p.horario_fim || p.horario_inicio, arena_nome: p.local_nome });
  };

  const enviarConvite = async () => {
    if (!user) return;
    const { error } = await supabase.from("goleiros_convites").insert({
      pelada_id: form.pelada_id || null, capitao_id: user.id, goleiro_id: id,
      data: form.data, horario_inicio: form.horario_inicio, horario_fim: form.horario_fim,
      arena_nome: form.arena_nome, valor_combinado: form.valor_combinado ? Number(form.valor_combinado) : null,
      mensagem: form.mensagem || null,
    } as never);
    if (error) toast.error(error.message); else { toast.success("Convite enviado!"); setOpen(false); }
  };

  if (!g) return <div className="p-8 text-center">Carregando...</div>;
  const media = avs.length ? avs.reduce((s,a)=>s+a.nota,0)/avs.length : 0;

  return (
    <div className="min-h-screen bg-background p-4 max-w-2xl mx-auto space-y-3">
      <Card className="p-4 flex gap-4 items-center">
        <div className="w-20 h-20 rounded-full bg-muted overflow-hidden">{g.profiles?.foto_url && <img src={g.profiles.foto_url} className="w-full h-full object-cover"/>}</div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{g.profiles?.nome}</h1>
          {g.profiles?.handle && <p className="text-sm font-medium text-primary">@{g.profiles.handle}</p>}
          <p className="text-sm text-muted-foreground">{g.profiles?.cidade}{g.profiles?.estado && `/${g.profiles.estado}`}</p>
          <div className="flex items-center gap-1 mt-1"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400"/><span className="font-bold">{media.toFixed(1)}</span><span className="text-xs text-muted-foreground">({avs.length})</span></div>
        </div>
      </Card>

      <Card className="p-4 space-y-2">
        <div className="flex gap-1">{g.tipos_quadra?.map((t:string)=><Badge key={t}>{t}</Badge>)}</div>
        <div className="text-emerald-500 font-bold text-xl">R$ {Number(g.valor_hora).toFixed(2)}/h</div>
        {g.bio && <p className="text-sm">{g.bio}</p>}
      </Card>

      <Card className="p-4">
        <h3 className="font-bold mb-2">Disponibilidade</h3>
        {disp.length === 0 ? <p className="text-sm text-muted-foreground">Sem horários cadastrados.</p> : disp.map(d=>(
          <div key={d.id} className="text-sm flex justify-between py-1"><span>{DIAS[d.dia_semana]}</span><span>{d.horario_inicio?.slice(0,5)} – {d.horario_fim?.slice(0,5)}</span></div>
        ))}
      </Card>

      {user && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="w-full" size="lg">Convidar para Pelada</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Convidar {g.profiles?.nome}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {peladas.length > 0 && <div><Label>Pelada</Label>
                <Select value={form.pelada_id} onValueChange={selectPelada}><SelectTrigger><SelectValue placeholder="Sua pelada"/></SelectTrigger><SelectContent>
                  {peladas.map(p=><SelectItem key={p.id} value={p.id}>{p.nome_pelada} — {p.data}</SelectItem>)}
                </SelectContent></Select>
              </div>}
              <div><Label>Data</Label><Input type="date" value={form.data} onChange={e=>setForm({...form,data:e.target.value})}/></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início</Label><Input type="time" value={form.horario_inicio} onChange={e=>setForm({...form,horario_inicio:e.target.value})}/></div>
                <div><Label>Fim</Label><Input type="time" value={form.horario_fim} onChange={e=>setForm({...form,horario_fim:e.target.value})}/></div>
              </div>
              <div><Label>Arena</Label><Input value={form.arena_nome} onChange={e=>setForm({...form,arena_nome:e.target.value})}/></div>
              <div><Label>Valor (opcional)</Label><Input type="number" step="0.01" value={form.valor_combinado} onChange={e=>setForm({...form,valor_combinado:e.target.value})}/></div>
              <div><Label>Mensagem</Label><Textarea maxLength={200} value={form.mensagem} onChange={e=>setForm({...form,mensagem:e.target.value})}/></div>
              <Button onClick={enviarConvite} className="w-full" disabled={!form.data || !form.horario_inicio}>Enviar Convite</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
