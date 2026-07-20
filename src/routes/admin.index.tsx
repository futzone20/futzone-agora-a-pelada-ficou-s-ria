import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/admin/")({ component: Dashboard });

function brl(n:number){return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}

function Dashboard() {
  const [stats, setStats] = useState<any>({});
  useEffect(() => { void (async () => {
    const since = new Date(Date.now() - 7*24*3600*1000).toISOString();
    const monthIni = new Date(); monthIni.setDate(1);
    const [{ count: users }, { count: novosUsers }, { count: grupos }, { count: peladasMes },
           { data: subs }, { count: arenas }, { count: parc },
           { data: fin }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since),
      supabase.from("grupos").select("*", { count: "exact", head: true }),
      supabase.from("peladas").select("*", { count: "exact", head: true }).gte("data", monthIni.toISOString().slice(0,10)),
      supabase.from("stripe_assinaturas").select("plano,status").eq("status","ativa"),
      supabase.from("arenas").select("*", { count: "exact", head: true }),
      supabase.from("parceiros").select("*", { count: "exact", head: true }),
      supabase.from("admin_financeiro").select("tipo,valor").gte("data_lancamento", monthIni.toISOString().slice(0,10)),
    ]);
    const planoPrecos: Record<string,number> = { jogador_premium: 9.90, dono_quadra: 99.90, parceiro: 49.90 };
    const mrr = (subs ?? []).reduce((s, sub: any) => s + (planoPrecos[sub.plano] ?? 0), 0);
    const rec = (fin ?? []).filter((l:any)=>l.tipo==="receita").reduce((s,l:any)=>s+Number(l.valor),0);
    setStats({ users, novosUsers, grupos, peladasMes, subs: subs?.length ?? 0, arenas, parc, mrr, rec });
  })(); }, []);
  const Stat = ({ label, val }:{label:string;val:any}) => (
    <Card className="p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-bold">{val ?? "—"}</div></Card>
  );
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Usuários" val={stats.users}/>
        <Stat label="Novos (7d)" val={stats.novosUsers}/>
        <Stat label="Grupos ativos" val={stats.grupos}/>
        <Stat label="Peladas do mês" val={stats.peladasMes}/>
        <Stat label="Assinaturas ativas" val={stats.subs}/>
        <Stat label="Arenas" val={stats.arenas}/>
        <Stat label="Parceiros" val={stats.parc}/>
        <Stat label="MRR" val={stats.mrr != null ? brl(stats.mrr) : "—"}/>
        <Stat label="Receita do mês" val={stats.rec != null ? brl(stats.rec) : "—"}/>
      </div>
    </div>
  );
}
