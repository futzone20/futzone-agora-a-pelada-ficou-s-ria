import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/financeiro")({ component: FinanceiroPage });

function brl(n:number){return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

function FinanceiroPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [lans, setLans] = useState<any[]>([]);
  const [ini, setIni] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); });
  const [fim, setFim] = useState(() => new Date().toISOString().slice(0,10));
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ tipo:"receita", descricao:"", valor:0, categoria:"outro", data_lancamento: new Date().toISOString().slice(0,10) });

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return; setArena(a);
    const { data } = await supabase.from("financeiro_lancamentos").select("*").eq("arena_id", a.id).gte("data_lancamento", ini).lte("data_lancamento", fim).order("data_lancamento", { ascending: false });
    setLans(data ?? []);
  };
  useEffect(() => { void load(); }, [user?.id, ini, fim]);

  const criar = async () => {
    if (!arena) return;
    const { error } = await supabase.from("financeiro_lancamentos").insert({ ...form, arena_id: arena.id, origem: "manual" } as never);
    if (error) toast.error(error.message); else { setOpen(false); setForm({ tipo:"receita", descricao:"", valor:0, categoria:"outro", data_lancamento: new Date().toISOString().slice(0,10) }); void load(); }
  };

  const excluir = async (l:any) => {
    if (l.origem !== "manual") { toast.error("Lançamento automático não pode ser excluído"); return; }
    await supabase.from("financeiro_lancamentos").delete().eq("id", l.id);
    void load();
  };

  const exportar = () => {
    const csv = "data,tipo,origem,categoria,descricao,valor\n" + lans.map(l => `${l.data_lancamento},${l.tipo},${l.origem},${l.categoria||""},"${l.descricao}",${l.valor}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "financeiro.csv"; a.click();
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  const filtrados = lans.filter(l => filtroTipo === "todos" || l.tipo === filtroTipo);
  const totRec = lans.filter(l=>l.tipo==="receita").reduce((s,l)=>s+Number(l.valor),0);
  const totDes = lans.filter(l=>l.tipo==="despesa").reduce((s,l)=>s+Number(l.valor),0);
  const lucro = totRec - totDes;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div><Label>De</Label><Input type="date" value={ini} onChange={e=>setIni(e.target.value)}/></div>
        <div><Label>Até</Label><Input type="date" value={fim} onChange={e=>setFim(e.target.value)}/></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Receitas</div><div className="text-emerald-500 font-bold">{brl(totRec)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Despesas</div><div className="text-rose-500 font-bold">{brl(totDes)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Lucro</div><div className={`font-bold ${lucro>=0?"text-emerald-500":"text-rose-500"}`}>{brl(lucro)}</div></Card>
      </div>

      <Tabs defaultValue="lista">
        <TabsList className="w-full"><TabsTrigger value="lista" className="flex-1">Lançamentos</TabsTrigger></TabsList>
        <TabsContent value="lista" className="space-y-2">
          <div className="flex gap-2">
            <Select value={filtroTipo} onValueChange={setFiltroTipo}><SelectTrigger className="flex-1"><SelectValue/></SelectTrigger><SelectContent>
              <SelectItem value="todos">Todos</SelectItem><SelectItem value="receita">Receitas</SelectItem><SelectItem value="despesa">Despesas</SelectItem>
            </SelectContent></Select>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4"/></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Tipo</Label><Select value={form.tipo} onValueChange={v=>setForm({...form,tipo:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent></Select></div>
                  <div><Label>Descrição</Label><Input value={form.descricao} onChange={e=>setForm({...form,descricao:e.target.value})}/></div>
                  <div><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={e=>setForm({...form,valor:+e.target.value})}/></div>
                  <div><Label>Categoria</Label><Input value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})}/></div>
                  <div><Label>Data</Label><Input type="date" value={form.data_lancamento} onChange={e=>setForm({...form,data_lancamento:e.target.value})}/></div>
                  <Button onClick={criar} className="w-full" disabled={!form.descricao}>Adicionar</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={exportar}>CSV</Button>
          </div>
          {filtrados.map(l=>(
            <Card key={l.id} className="p-3 flex justify-between items-start">
              <div>
                <div className="font-bold text-sm">{l.descricao}</div>
                <div className="text-xs text-muted-foreground">{l.data_lancamento} · {l.origem} · {l.categoria}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`font-bold ${l.tipo==="receita"?"text-emerald-500":"text-rose-500"}`}>{l.tipo==="receita"?"+":"-"}{brl(Number(l.valor))}</div>
                {l.origem === "manual" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>excluir(l)}><Trash className="h-3 w-3"/></Button>}
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
