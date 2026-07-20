import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/jogador/parceiros/")({ component: JogParceiros });

function JogParceiros() {
  const { user } = useAuth();
  const [pontos, setPontos] = useState(0);
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [cat, setCat] = useState("todas");
  const [cidade, setCidade] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("pontos_total, cidade").eq("user_id", user.id).maybeSingle();
      setPontos((p as any)?.pontos_total ?? 0);
      if ((p as any)?.cidade && !cidade) setCidade((p as any).cidade);
    })();
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      let q = supabase.from("parceiros").select("*, parceiros_recompensas(id, ativo)").eq("ativo", true);
      if (cat !== "todas") q = q.eq("categoria", cat);
      if (cidade) q = q.ilike("cidade", `%${cidade}%`);
      const { data } = await q;
      setParceiros(data ?? []);
    })();
  }, [cat, cidade]);

  return (
    <div className="space-y-3">
      <Card className="p-4 bg-gradient-to-r from-primary/20 to-primary/5">
        <div className="text-xs text-muted-foreground">Seus pontos</div>
        <div className="text-3xl font-bold">{pontos} <span className="text-sm">pts Futzone</span></div>
      </Card>

      <div className="flex gap-2">
        <Select value={cat} onValueChange={setCat}><SelectTrigger className="flex-1"><SelectValue/></SelectTrigger><SelectContent>
          <SelectItem value="todas">Todas categorias</SelectItem>
          <SelectItem value="restaurante">Restaurante</SelectItem>
          <SelectItem value="loja_esportiva">Loja Esportiva</SelectItem>
          <SelectItem value="academia">Academia</SelectItem>
          <SelectItem value="bar">Bar</SelectItem>
          <SelectItem value="outro">Outro</SelectItem>
        </SelectContent></Select>
        <Input placeholder="Cidade" value={cidade} onChange={e=>setCidade(e.target.value)} className="flex-1"/>
      </div>

      {parceiros.map(p=>{
        const ativas = (p.parceiros_recompensas ?? []).filter((r:any)=>r.ativo).length;
        return (
          <Link key={p.id} to="/jogador/parceiros/$slug" params={{slug: p.slug}}>
            <Card className="p-3 flex gap-3 items-center">
              <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden">{p.logo_url && <img src={p.logo_url} className="w-full h-full object-cover"/>}</div>
              <div className="flex-1">
                <div className="font-bold">{p.nome_estabelecimento}</div>
                <div className="text-xs text-muted-foreground">{p.categoria} · {p.cidade}</div>
                <div className="text-xs text-primary mt-1">{ativas} recompensa(s)</div>
              </div>
            </Card>
          </Link>
        );
      })}
      {parceiros.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum parceiro encontrado.</p>}
    </div>
  );
}
