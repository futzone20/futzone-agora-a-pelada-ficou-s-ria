import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, MapPin } from "lucide-react";
import { toast } from "sonner";
import { obterLocalizacaoCompleta, distanciaKm, type Coordenadas } from "@/lib/geolocalizacao";

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
  const [minhaLoc, setMinhaLoc] = useState<Coordenadas | null>(null);
  const [buscandoLoc, setBuscandoLoc] = useState(false);
  const [localizacaoDe, setLocalizacaoDe] = useState<"perfil" | "atual" | null>(null);

  // Se a pessoa já salvou a localização no perfil dela, usa direto —
  // ninguém precisa clicar no botão toda vez que abrir a busca.
  useEffect(() => {
    if (user?.latitude != null && user?.longitude != null && !minhaLoc) {
      setMinhaLoc({ latitude: user.latitude, longitude: user.longitude });
      setLocalizacaoDe("perfil");
      setOrdem("distancia");
      if (user.cidade) setCidade(user.cidade);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.latitude, user?.longitude]);

  const usarMinhaLocalizacao = async () => {
    setBuscandoLoc(true);
    try {
      const loc = await obterLocalizacaoCompleta();
      setMinhaLoc({ latitude: loc.latitude, longitude: loc.longitude });
      setLocalizacaoDe("atual");
      setCidade(loc.cidade);
      setOrdem("distancia");
      toast.success(`Localização encontrada: ${loc.cidade}${loc.estado ? `/${loc.estado}` : ""} — mostrando os mais próximos`);
    } catch (e: any) {
      toast.error(e.message || "Não foi possível obter sua localização");
    } finally {
      setBuscandoLoc(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: g } = await supabase.from("goleiros_perfil").select("*, profiles!goleiros_perfil_user_id_fkey(nome, cidade, estado, foto_url, whatsapp, handle, latitude, longitude)").eq("ativo_catalogo", true);
      const ids = (g ?? []).map((x:any)=>x.id);
      const userIds = (g ?? []).map((x:any)=>x.user_id);
      // Nota unificada: vem das skills reais de goleiro (construídas a partir das
      // avaliações de pelada de verdade), não mais de um catálogo separado.
      let skillsMap: Record<string, { nivel: number; n: number }> = {};
      if (userIds.length) {
        const { data: sk } = await (supabase as any).from("skills_goleiro").select("user_id, reflexo, seguranca, jogo_aereo, saida_pes, posicionamento, comando_area, total_avaliacoes_recebidas").in("user_id", userIds);
        (sk ?? []).forEach((s: any) => {
          const nivel = (s.reflexo + s.seguranca + s.jogo_aereo + s.saida_pes + s.posicionamento + s.comando_area) / 6;
          skillsMap[s.user_id] = { nivel, n: s.total_avaliacoes_recebidas || 0 };
        });
      }
      let bloq: Record<string, boolean> = {};
      if (data && hora && ids.length) {
        const { data: bs } = await supabase.from("goleiros_bloqueios").select("goleiro_id").in("goleiro_id", ids).eq("data", data).lte("horario_inicio", hora).gte("horario_fim", hora);
        (bs ?? []).forEach((b:any)=>{ bloq[b.goleiro_id] = true; });
      }
      let arr = (g ?? []).map((x:any)=>{
        const lat = x.profiles?.latitude, lng = x.profiles?.longitude;
        const distancia = minhaLoc && lat != null && lng != null
          ? distanciaKm(minhaLoc, { latitude: lat, longitude: lng })
          : null;
        return {
          ...x,
          _media: skillsMap[x.user_id]?.nivel ?? 3,
          _n: skillsMap[x.user_id]?.n ?? 0,
          _ocupado: !!bloq[x.id],
          _distancia: distancia,
        };
      });
      if (cidade) arr = arr.filter((x:any)=>x.profiles?.cidade?.toLowerCase().includes(cidade.toLowerCase()));
      if (tipo !== "todos") arr = arr.filter((x:any)=>x.tipos_quadra?.includes(tipo));
      if (ordem === "distancia") {
        arr.sort((a:any,b:any)=>{
          if (a._distancia == null && b._distancia == null) return 0;
          if (a._distancia == null) return 1;
          if (b._distancia == null) return -1;
          return a._distancia - b._distancia;
        });
      } else if (ordem === "avaliacao") arr.sort((a:any,b:any)=>b._media - a._media);
      else if (ordem === "preco") arr.sort((a:any,b:any)=>Number(a.valor_hora) - Number(b.valor_hora));
      setGoleiros(arr);
    })();
  }, [cidade, tipo, data, hora, ordem, minhaLoc]);

  return (
    <div className="min-h-screen bg-background p-4 max-w-3xl mx-auto space-y-3">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">🧤 Goleiros</h1>{user && <Button variant="ghost" onClick={()=>navigate({to:"/jogador"})}>Voltar</Button>}</div>
      <Card className="p-3 space-y-2">
        <Button type="button" variant="outline" disabled={buscandoLoc} onClick={usarMinhaLocalizacao} className="w-full">
          <MapPin className="h-4 w-4 mr-1.5" /> {buscandoLoc ? "Localizando..." : "Usar minha localização"}
        </Button>
        {minhaLoc && (
          <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-primary font-medium">
              <MapPin className="h-3.5 w-3.5" />
              {localizacaoDe === "perfil" ? "Usando a localização salva no seu perfil" : "Localização atual em uso"}
              {cidade && ` — ${cidade}`}
            </span>
            <button onClick={usarMinhaLocalizacao} className="text-muted-foreground underline shrink-0">atualizar</button>
          </div>
        )}
        <Input placeholder="Ou digite uma cidade" value={cidade} onChange={e=>setCidade(e.target.value)}/>
        <div className="grid grid-cols-2 gap-2">
          <Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
            <SelectItem value="todos">Todos tipos</SelectItem><SelectItem value="society">Society</SelectItem><SelectItem value="futsal">Futsal</SelectItem><SelectItem value="campo">Campo</SelectItem>
          </SelectContent></Select>
          <Select value={ordem} onValueChange={setOrdem}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
            {minhaLoc && <SelectItem value="distancia">Mais próximos</SelectItem>}
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
              <div className="flex items-center gap-1.5">
                <span className="font-bold">{g.profiles?.nome}</span>
                {g.profiles?.handle && <span className="text-xs font-medium text-primary">@{g.profiles.handle}</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {g.profiles?.cidade}{g.profiles?.estado && `/${g.profiles.estado}`}
                {g._distancia != null && <span className="ml-1.5 font-medium text-primary">· {g._distancia < 1 ? "menos de 1 km" : `${g._distancia.toFixed(0)} km`}</span>}
              </div>
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
