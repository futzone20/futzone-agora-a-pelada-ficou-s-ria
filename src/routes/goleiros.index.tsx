import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";

export const Route = createFileRoute("/goleiros/")({ component: GoleirosCat });

function GoleirosCat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [goleiros, setGoleiros] = useState<any[]>([]);
  const [cidade, setCidade] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [ordem, setOrdem] = useState("avaliacao");

  useEffect(() => {
    (async () => {
      const { data: g } = await supabase.from("goleiros_perfil").select("*, profiles!goleiros_perfil_user_id_fkey(nome, cidade, estado, foto_url, whatsapp)").eq("ativo_catalogo", true);
      const ids = (g ?? []).map((x:any)=>x.id);
      let medias: Record<string, {soma:number; n:number}> = {};
      if (ids.length) {
        const { data: avs } = await supabase.from("goleiros_avaliacoes").select("goleiro_id, nota").in("goleiro_id", ids);
        (avs ?? []).forEach((a:any)=>{ const m = medias[a.goleiro_id] ??= {soma:0,n:0}; m.soma += a.nota; m.n++; });
      }
      let bloq: Record<string, boolean> = {};
      if (data && hora && ids.length) {
        const { data: bs } = await supabase.from("goleiros_bloqueios").select("goleiro_id").in("goleiro_id", ids).eq("data", data).lte("horario_inicio", hora).gte("horario_fim", hora);
        (bs ?? []).forEach((b:any)=>{ bloq[b.goleiro_id] = true; });
      }
      let arr = (g ?? []).map((x:any)=>({...x, _media: medias[x.id] ? medias[x.id].soma/medias[x.id].n : 0, _n: medias[x.id]?.n ?? 0, _ocupado: !!bloq[x.id] }));
      if (cidade) arr = arr.filter((x:any)=>x.profiles?.cidade?.toLowerCase().includes(cidade.toLowerCase()));
      if (tipo !== "todos") arr = arr.filter((x:any)=>x.tipos_quadra?.includes(tipo));
      if (ordem === "avaliacao") arr.sort((a:any,b:any)=>b._media - a._media);
      else if (ordem === "preco") arr.sort((a:any,b:any)=>Number(a.valor_hora) - Number(b.valor_hora));
      setGoleiros(arr);
    })();
  }, [cidade, tipo, data, hora, ordem]);

  return (
    <div className="min-h-screen bg-background p-4 max-w-3xl mx-auto space-y-3">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">🧤 Goleiros</h1>{user && <Button variant="ghost" onClick={()=>navigate({to:"/jogador"})}>Voltar</Button>}</div>
      <Card className="p-3 space-y-2">
        <Input placeholder="Cidade" value={cidade} onChange={e=>setCidade(e.target.value)}/>
        <div className="grid grid-cols-2 gap-2">
          <Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem><SelectItem value="society">Society</SelectItem><SelectItem value="futsal">Futsal</SelectItem><SelectItem value="campo">Campo</SelectItem>
          </SelectContent></Select>
          <Select value={ordem} onValueChange={setOrdem}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
            <SelectItem value="avaliacao">Melhor avaliado</SelectItem><SelectItem value="preco">Menor preço</SelectItem>
          </SelectContent></Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={data} onChange={e=>setData(e.target.value)}/>
          <Input type="time" value={hora} onChange={e=>setHora(e.target.value)}/>
        </div>
      </Card>

      {goleiros.map(g=>(
        <Link key={g.id} to="/goleiros/$id" params={{id: g.id}}>
          <Card className="p-3 flex gap-3 items-center">
            <div className="w-14 h-14 rounded-full bg-muted overflow-hidden">{g.profiles?.foto_url && <img src={g.profiles.foto_url} className="w-full h-full object-cover"/>}</div>
            <div className="flex-1">
              <div className="font-bold">{g.profiles?.nome}</div>
              <div className="text-xs text-muted-foreground">{g.profiles?.cidade}{g.profiles?.estado && `/${g.profiles.estado}`}</div>
              <div className="flex gap-1 mt-1">{g.tipos_quadra?.map((t:string)=><Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400"/>{g._media.toFixed(1)} ({g._n})
                <span className="text-emerald-500 font-bold">R$ {Number(g.valor_hora).toFixed(2)}/h</span>
              </div>
            </div>
            {data && hora && <Badge variant={g._ocupado?"outline":"default"}>{g._ocupado?"Ocupado":"Livre"}</Badge>}
          </Card>
        </Link>
      ))}
      {goleiros.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Nenhum goleiro encontrado.</p>}
    </div>
  );
}
