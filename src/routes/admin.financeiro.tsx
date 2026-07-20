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
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/financeiro")({ component: Page });

function brl(n:number){return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

function Page() {
  const { user } = useAuth();
  const [lans, setLans] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [ini, setIni] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10); });
  const [fim, setFim] = useState(() => new Date().toISOString().slice(0,10));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ tipo:"receita", origem:"manual", descricao:"", valor:0, data_lancamento: new Date().toISOString().slice(0,10) });

  const load = async () => {
    const [{ data: l }, { data: s }] = await Promise.all([
      supabase.from("admin_financeiro").select("*").gte("data_lancamento", ini).lte("data_lancamento", fim).order("data_lancamento", { ascending: false }),
      supabase.from("stripe_assinaturas").select("*, profiles:user_id(nome,email)").order("criado_em", { ascending: false }),
    ]);
    setLans(l ?? []); setSubs(s ?? []);
  };
  useEffect(() => { void load(); }, [ini, fim]);

  const rec = lans.filter(l=>l.tipo==="receita").reduce((s,l)=>s+Number(l.valor),0);
  const des = lans.filter(l=>l.tipo==="despesa").reduce((s,l)=>s+Number(l.valor),0);
  const planoPrecos: Record<string,number> = { jogador_premium: 9.90, dono_quadra: 99.90, parceiro: 49.90 };
  const mrr = subs.filter(s=>s.status==="ativa").reduce((acc,s)=>acc+(planoPrecos[s.plano]??0),0);

  const criar = async () => {
    if (!user) return;
    const { error } = await supabase.from("admin_financeiro").insert({ ...f } as never);
    if (error) toast.error(error.message); else { setOpen(false); await supabase.from("admin_log").insert({ admin_id: user.id, acao: "lancamento_manual", detalhes: f } as never); void load(); }
  };

  const cancelarSub = async (id: string) => {
    await supabase.from("stripe_assinaturas").update({ status: "cancelada", atualizado_em: new Date().toISOString() }).eq("id", id);
    void load();
  };

  const csv = () => {
    const txt = "data,tipo,origem,descricao,valor\n" + lans.map(l=>`${l.data_lancamento},${l.tipo},${l.origem},"${l.descricao}",${l.valor}`).join("\n");
    const u = URL.createObjectURL(new Blob([txt], { type: "text/csv" })); const a = document.createElement("a"); a.href = u; a.download="financeiro.csv"; a.click();
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold">Financeiro Futzone</h2>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>De</Label><Input type="date" value={ini} onChange={e=>setIni(e.target.value)}/></div>
        <div><Label>Até</Label><Input type="date" value={fim} onChange={e=>setFim(e.target.value)}/></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card className="p-3"><div className="text-xs text-muted-foreground">MRR</div><div className="font-bold">{brl(mrr)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Receita</div><div className="font-bold text-emerald-500">{brl(rec)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Despesas</div><div className="font-bold text-rose-500">{brl(des)}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Lucro</div><div className={`font-bold ${rec-des>=0?"text-emerald-500":"text-rose-500"}`}>{brl(rec-des)}</div></Card>
      </div>
      <Tabs defaultValue="lans">
        <TabsList className="w-full"><TabsTrigger value="lans" className="flex-1">Lançamentos</TabsTrigger><TabsTrigger value="subs" className="flex-1">Assinaturas</TabsTrigger></TabsList>
        <TabsContent value="lans" className="space-y-2">
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1"/>Novo</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Lançamento manual</DialogTitle></DialogHeader>
                <div className="space-y-2">
                  <Select value={f.tipo} onValueChange={v=>setF({...f,tipo:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="receita">Receita</SelectItem><SelectItem value="despesa">Despesa</SelectItem></SelectContent></Select>
                  <Input placeholder="Descrição" value={f.descricao} onChange={e=>setF({...f,descricao:e.target.value})}/>
                  <Input type="number" step="0.01" placeholder="Valor" value={f.valor} onChange={e=>setF({...f,valor:+e.target.value})}/>
                  <Input type="date" value={f.data_lancamento} onChange={e=>setF({...f,data_lancamento:e.target.value})}/>
                  <Button onClick={criar} className="w-full" disabled={!f.descricao}>Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="outline" onClick={csv}>CSV</Button>
          </div>
          {lans.map(l=>(
            <Card key={l.id} className="p-3 flex justify-between"><div><div className="font-bold text-sm">{l.descricao}</div><div className="text-xs text-muted-foreground">{l.data_lancamento} · {l.origem}</div></div>
              <div className={`font-bold ${l.tipo==="receita"?"text-emerald-500":"text-rose-500"}`}>{l.tipo==="receita"?"+":"-"}{brl(Number(l.valor))}</div></Card>
          ))}
        </TabsContent>
        <TabsContent value="subs" className="space-y-2">
          {subs.map((s:any)=>(
            <Card key={s.id} className="p-3 flex justify-between items-center"><div>
              <div className="font-bold text-sm">{s.profiles?.nome ?? s.user_id}</div>
              <div className="text-xs text-muted-foreground">{s.plano} · {s.status} · {brl(planoPrecos[s.plano] ?? 0)}/mês</div>
            </div>
              {s.status === "ativa" && <Button size="sm" variant="outline" onClick={()=>cancelarSub(s.id)}>Cancelar</Button>}
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
