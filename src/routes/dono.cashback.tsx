import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/dono/cashback")({ component: CashbackPage });

function brl(n:number){return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

function CashbackPage() {
  const { user } = useAuth();
  const [arena, setArena] = useState<any>(null);
  const [cfg, setCfg] = useState<any>({ percentual: 5, ativo: false, aplicar_em: "ambos", validade_dias: null });
  const [saldos, setSaldos] = useState<any[]>([]);
  const [hist, setHist] = useState<any[]>([]);
  const [busca, setBusca] = useState("");

  const load = async () => {
    if (!user) return;
    const { data: a } = await supabase.from("arenas").select("*").eq("user_id", user.id).maybeSingle();
    if (!a) return; setArena(a);
    const { data: c } = await supabase.from("cashback_config").select("*").eq("arena_id", a.id).maybeSingle();
    if (c) setCfg(c);
    const { data: s } = await supabase.from("cashback_saldo").select("*, profiles(nome, whatsapp, foto_url)").eq("arena_id", a.id).order("saldo", { ascending: false });
    setSaldos(s ?? []);
    const { data: h } = await supabase.from("cashback_historico").select("*, profiles(nome)").eq("arena_id", a.id).order("criado_em", { ascending: false }).limit(100);
    setHist(h ?? []);
  };
  useEffect(() => { void load(); }, [user?.id]);

  const salvarCfg = async () => {
    if (!arena) return;
    const payload = { ...cfg, arena_id: arena.id, atualizado_em: new Date().toISOString() };
    const { error } = await supabase.from("cashback_config").upsert(payload as never, { onConflict: "arena_id" });
    if (error) toast.error(error.message); else toast.success("Configuração salva");
  };

  const exportar = () => {
    const csv = "tipo,valor,saldo_apos,origem,usuario,data\n" + hist.map(h => `${h.tipo},${h.valor},${h.saldo_apos},${h.origem},${h.profiles?.nome||""},${h.criado_em}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "cashback.csv"; a.click();
  };

  if (!arena) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena primeiro.</div>;

  const saldosFiltrados = saldos.filter(s => !busca || s.profiles?.nome?.toLowerCase().includes(busca.toLowerCase()) || s.profiles?.whatsapp?.includes(busca));

  return (
    <Tabs defaultValue="config">
      <TabsList className="w-full"><TabsTrigger value="config" className="flex-1">Config</TabsTrigger><TabsTrigger value="saldos" className="flex-1">Saldos</TabsTrigger><TabsTrigger value="hist" className="flex-1">Histórico</TabsTrigger></TabsList>

      <TabsContent value="config">
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between"><Label>Ativo</Label><Switch checked={cfg.ativo} onCheckedChange={v=>setCfg({...cfg,ativo:v})}/></div>
          <div><Label>Percentual (%)</Label><Input type="number" step="0.1" value={cfg.percentual} onChange={e=>setCfg({...cfg,percentual:+e.target.value})}/></div>
          <div><Label>Aplicar em</Label><Select value={cfg.aplicar_em} onValueChange={v=>setCfg({...cfg,aplicar_em:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
            <SelectItem value="agendamento">Agendamento</SelectItem><SelectItem value="pdv">PDV</SelectItem><SelectItem value="ambos">Ambos</SelectItem>
          </SelectContent></Select></div>
          <div><Label>Validade (dias, opcional)</Label><Input type="number" value={cfg.validade_dias ?? ""} onChange={e=>setCfg({...cfg,validade_dias: e.target.value ? +e.target.value : null})}/></div>
          <Button onClick={salvarCfg} className="w-full">Salvar</Button>
        </Card>
      </TabsContent>

      <TabsContent value="saldos" className="space-y-2">
        <Input placeholder="Buscar nome ou WhatsApp" value={busca} onChange={e=>setBusca(e.target.value)}/>
        {saldosFiltrados.map(s=>(
          <Card key={s.id} className="p-3 flex justify-between"><div><div className="font-bold">{s.profiles?.nome}</div><div className="text-xs text-muted-foreground">{s.profiles?.whatsapp}</div></div><div className="text-emerald-500 font-bold">{brl(Number(s.saldo))}</div></Card>
        ))}
      </TabsContent>

      <TabsContent value="hist" className="space-y-2">
        <Button variant="outline" size="sm" onClick={exportar}>Exportar CSV</Button>
        {hist.map(h=>(
          <Card key={h.id} className="p-3 flex justify-between text-sm"><div><div className="font-bold">{h.profiles?.nome}</div><div className="text-xs text-muted-foreground">{h.origem} · {new Date(h.criado_em).toLocaleDateString("pt-BR")}</div></div><div className={h.tipo==="credito"?"text-emerald-500 font-bold":"text-rose-500 font-bold"}>{h.tipo==="credito"?"+":"-"}{brl(Number(h.valor))}</div></Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}
