import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Calendar, DollarSign, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/dono/")({ component: DashboardDono });

function brl(n: number) { return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function DashboardDono() {
  const { user } = useAuth();
  const [arenaId, setArenaId] = useState<string | null>(null);
  const [receita, setReceita] = useState(0);
  const [despesa, setDespesa] = useState(0);
  const [agHoje, setAgHoje] = useState(0);
  const [agSemana, setAgSemana] = useState(0);
  const [estoqueCritico, setEstoqueCritico] = useState(0);
  const [proximos, setProximos] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: a } = await supabase.from("arenas").select("id").eq("user_id", user.id).maybeSingle();
      if (!a) return;
      setArenaId(a.id);
      const ini = new Date(); ini.setDate(1); ini.setHours(0,0,0,0);
      const { data: lan } = await supabase.from("financeiro_lancamentos").select("tipo,valor").eq("arena_id", a.id).gte("data_lancamento", ini.toISOString().slice(0,10));
      setReceita((lan ?? []).filter((l:any)=>l.tipo==="receita").reduce((s:number,l:any)=>s+Number(l.valor),0));
      setDespesa((lan ?? []).filter((l:any)=>l.tipo==="despesa").reduce((s:number,l:any)=>s+Number(l.valor),0));
      const hoje = new Date().toISOString().slice(0,10);
      const semana = new Date(Date.now()+7*86400000).toISOString().slice(0,10);
      const { count: c1 } = await supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("arena_id", a.id).eq("data", hoje);
      const { count: c2 } = await supabase.from("agendamentos").select("id", { count: "exact", head: true }).eq("arena_id", a.id).gte("data", hoje).lte("data", semana);
      setAgHoje(c1 ?? 0); setAgSemana(c2 ?? 0);
      const { data: prods } = await supabase.from("pdv_produtos").select("id,estoque_atual,estoque_minimo").eq("arena_id", a.id).eq("ativo", true);
      setEstoqueCritico((prods ?? []).filter((p:any)=>p.estoque_atual <= p.estoque_minimo).length);
      const { data: prox } = await supabase.from("agendamentos").select("id,horario_inicio,quadra_id,capitao_id,valor_cobrado,status,quadras(nome)").eq("arena_id", a.id).eq("data", hoje).order("horario_inicio").limit(5);
      setProximos(prox ?? []);
    })();
  }, [user?.id]);

  if (!arenaId) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre sua arena em <b>Arena</b> para começar.</div>;
  const lucro = receita - despesa;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3"/>Receita do mês</div><div className="text-xl font-bold text-emerald-500 mt-1">{brl(receita)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingDown className="h-3 w-3"/>Despesas</div><div className="text-xl font-bold text-rose-500 mt-1">{brl(despesa)}</div></Card>
        <Card className="p-4 col-span-2"><div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3"/>Lucro do mês</div><div className={`text-2xl font-bold mt-1 ${lucro>=0?"text-emerald-500":"text-rose-500"}`}>{brl(lucro)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3"/>Hoje</div><div className="text-xl font-bold mt-1">{agHoje}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3"/>Semana</div><div className="text-xl font-bold mt-1">{agSemana}</div></Card>
        {estoqueCritico > 0 && (
          <Card className="p-4 col-span-2 border-rose-500/40 bg-rose-500/10"><div className="text-xs text-rose-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3"/>Estoque crítico</div><div className="text-xl font-bold mt-1">{estoqueCritico} produto(s)</div></Card>
        )}
      </div>
      <div>
        <h3 className="font-bold mb-2">Próximos agendamentos de hoje</h3>
        {proximos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum agendamento hoje.</p> : proximos.map((a:any)=>(
          <Card key={a.id} className="p-3 mb-2 flex justify-between items-center"><div><div className="font-bold">{a.horario_inicio?.slice(0,5)}</div><div className="text-xs text-muted-foreground">{a.quadras?.nome}</div></div><div className="text-sm">{brl(Number(a.valor_cobrado||0))}</div></Card>
        ))}
      </div>
    </div>
  );
}
