import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/parceiro/relatorios")({ component: Rel });

function Rel() {
  const { user } = useAuth();
  const [parc, setParc] = useState<any>(null);
  const [resgates, setResgates] = useState<any[]>([]);
  const [cliques, setCliques] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [ini, setIni] = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); });
  const [fim, setFim] = useState(() => new Date().toISOString().slice(0,10));

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("parceiros").select("*").eq("user_id", user.id).maybeSingle();
      if (!p) return; setParc(p);
      const { data: r } = await supabase.from("parceiros_recompensas").select("*").eq("parceiro_id", (p as any).id);
      setRecs(r ?? []);
      const { data: rg } = await supabase.from("parceiros_resgates").select("*").eq("parceiro_id", (p as any).id).gte("solicitado_em", ini).lte("solicitado_em", fim + " 23:59:59");
      setResgates(rg ?? []);
      const { data: cl } = await supabase.from("parceiros_cliques").select("*").eq("parceiro_id", (p as any).id).gte("criado_em", ini).lte("criado_em", fim + " 23:59:59");
      setCliques(cl ?? []);
    })();
  }, [user?.id, ini, fim]);

  const stats = useMemo(() => {
    const confirmados = resgates.filter(r=>r.status==="confirmado");
    const pontos = confirmados.reduce((s,r)=>s+r.pontos_debitados,0);
    const porRec: Record<string, any> = {};
    recs.forEach(r => { porRec[r.id] = { nome: r.nome, cliques: 0, pendentes: 0, confirmados: 0, cancelados: 0 }; });
    resgates.forEach(r => {
      const o = porRec[r.recompensa_id]; if (!o) return;
      if (r.status === "pendente") o.pendentes++;
      else if (r.status === "confirmado") o.confirmados++;
      else if (r.status === "cancelado" || r.status === "expirado") o.cancelados++;
    });
    cliques.forEach(c => { if (porRec[c.recompensa_id]) porRec[c.recompensa_id].cliques++; });
    const mais = confirmados.reduce((acc: Record<string,number>, r) => { acc[r.recompensa_id] = (acc[r.recompensa_id]||0)+1; return acc; }, {});
    const topId = Object.entries(mais).sort((a,b)=>b[1]-a[1])[0]?.[0];
    const topNome = recs.find(r=>r.id===topId)?.nome ?? "—";
    return { confirmados: confirmados.length, pontos, topNome, porRec: Object.values(porRec) };
  }, [resgates, cliques, recs]);

  if (!parc) return <div className="text-center text-sm text-muted-foreground py-8">Cadastre seu perfil primeiro.</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div><Label>De</Label><Input type="date" value={ini} onChange={e=>setIni(e.target.value)}/></div>
        <div><Label>Até</Label><Input type="date" value={fim} onChange={e=>setFim(e.target.value)}/></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3"><div className="text-xs text-muted-foreground">Resgates</div><div className="font-bold text-xl">{stats.confirmados}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Pontos</div><div className="font-bold text-xl">{stats.pontos}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">Mais resgatada</div><div className="font-bold text-sm">{stats.topNome}</div></Card>
      </div>

      <Card className="p-3">
        <h3 className="font-bold mb-2">Por recompensa</h3>
        <div className="space-y-2">
          {stats.porRec.map((r:any,i:number)=>{
            const conv = r.cliques > 0 ? ((r.confirmados/r.cliques)*100).toFixed(1) : "0";
            return (
              <div key={i} className="text-xs border-b pb-2">
                <div className="font-bold text-sm">{r.nome}</div>
                <div className="grid grid-cols-5 gap-1 mt-1">
                  <div>Cliques: <b>{r.cliques}</b></div>
                  <div>Pend: <b>{r.pendentes}</b></div>
                  <div>Conf: <b>{r.confirmados}</b></div>
                  <div>Canc: <b>{r.cancelados}</b></div>
                  <div>Conv: <b>{conv}%</b></div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
