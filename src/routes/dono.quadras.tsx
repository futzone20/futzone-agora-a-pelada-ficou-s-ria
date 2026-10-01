import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/quadras")({ component: QuadrasPage });

const FORM_VAZIO = { nome: "", tipo_superficie: "society", jogadores_por_time: 5, goleiros_por_time: 1, duracao_partida_padrao: 10, valor_diurno: 0, valor_noturno: 0, horario_corte_noturno: "18:00" };

function QuadrasPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [quadras, setQuadras] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(FORM_VAZIO);

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    setArena(a);
    if (a) {
      const { data: q } = await supabase.from("quadras").select("*").eq("arena_id", a.id).order("criado_em");
      setQuadras(q ?? []);
    }
  };
  useEffect(() => { void load(); }, [user?.id]);

  const criar = async () => {
    if (!arena) return;
    const { error } = await supabase.from("quadras").insert({ ...form, arena_id: arena.id } as never);
    if (error) toast.error(error.message); else { toast.success("Quadra criada"); setOpen(false); setForm(FORM_VAZIO); void load(); }
  };

  const toggle = async (q: any) => {
    await supabase.from("quadras").update({ ativo: !q.ativo } as never).eq("id", q.id);
    void load();
  };

  const copyUrl = (q: any) => {
    const url = `${window.location.origin}/placar/${arena.slug}/${q.slug}`;
    navigator.clipboard.writeText(url); toast.success("URL copiada");
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">Quadras</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1"/>Nova</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova quadra</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></div>
              <div><Label>Tipo de superfície</Label>
                <Select value={form.tipo_superficie} onValueChange={v=>setForm({...form,tipo_superficie:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="society">Society</SelectItem><SelectItem value="futsal">Futsal</SelectItem><SelectItem value="campo">Campo</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Duração (min)</Label><Input type="number" value={form.duracao_partida_padrao} onChange={e=>setForm({...form,duracao_partida_padrao:+e.target.value})}/></div>
                <div><Label>Corte noturno</Label><Input type="time" value={form.horario_corte_noturno} onChange={e=>setForm({...form,horario_corte_noturno:e.target.value})}/></div>
                <div><Label>Valor diurno (R$)</Label><Input type="number" value={form.valor_diurno} onChange={e=>setForm({...form,valor_diurno:+e.target.value})}/></div>
                <div><Label>Valor noturno (R$)</Label><Input type="number" value={form.valor_noturno} onChange={e=>setForm({...form,valor_noturno:+e.target.value})}/></div>
              </div>
              <p className="text-xs text-muted-foreground">A partir do horário de corte, vale o valor noturno. Antes disso, o valor diurno.</p>
              <Button onClick={criar} disabled={!form.nome} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {quadras.map(q => (
        <Card key={q.id} className="p-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold">{q.nome}</div>
              <div className="text-xs text-muted-foreground">{q.tipo_superficie} · {q.duracao_partida_padrao}min</div>
              <div className="text-xs text-muted-foreground">☀️ R$ {Number(q.valor_diurno ?? q.valor_padrao ?? 0).toFixed(2)} · 🌙 R$ {Number(q.valor_noturno ?? q.valor_padrao ?? 0).toFixed(2)} (a partir de {String(q.horario_corte_noturno ?? "18:00").slice(0,5)})</div>
              <div className="text-xs mt-1 break-all">/{arena.slug}/{q.slug}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Switch checked={q.ativo} onCheckedChange={()=>toggle(q)}/>
              <Button size="sm" variant="outline" onClick={()=>copyUrl(q)}><Copy className="h-3 w-3 mr-1"/>URL</Button>
            </div>
          </div>
        </Card>
      ))}
      {quadras.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma quadra cadastrada.</p>}
    </div>
  );
}
