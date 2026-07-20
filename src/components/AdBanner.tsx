import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { X } from "lucide-react";

type Tela = "home" | "feed" | "ranking" | "peladas" | "parceiros" | "goleiros";

export function AdBanner({ tela }: { tela: Tela }) {
  const { user } = useAuth();
  const [ad, setAd] = useState<any>(null);
  const [closed, setClosed] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase.from("profiles").select("plano,cidade,estado,role").eq("user_id", user.id).maybeSingle();
      setProfile(data);
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user || !profile) return;
    if (profile.plano === "premium") return;
    void (async () => {
      const today = new Date().toISOString().slice(0,10);
      const { data: camps } = await supabase
        .from("ads_campanhas")
        .select("*, ads_criativos(*)")
        .eq("status", "ativa")
        .lte("data_inicio", today)
        .gte("data_fim", today);
      const role = profile?.role ?? "jogador";
      const cidade = profile?.cidade, estado = profile?.estado;
      const eligible = (camps ?? []).filter((c: any) => {
        if (!c.telas?.includes(tela)) return false;
        if (c.tipo === "patrocinio_pelada") return false;
        if (c.publico_alvo === "jogadores" && role !== "jogador") return false;
        if (c.publico_alvo === "capitaes" && role !== "capitao") return false;
        if (c.publico_alvo === "donos_quadra" && role !== "dono_quadra") return false;
        if (c.segmentacao_tipo === "cidade") {
          const list: string[] = c.segmentacao_valor?.cidades ?? [];
          if (cidade && list.length && !list.includes(cidade)) return false;
        }
        if (c.segmentacao_tipo === "estado") {
          const list: string[] = c.segmentacao_valor?.estados ?? [];
          if (estado && list.length && !list.includes(estado)) return false;
        }
        if (!c.ads_criativos?.length) return false;
        return true;
      });
      if (!eligible.length) return;
      // frequência: contar impressões hoje
      for (const c of eligible.sort(()=>Math.random()-0.5)) {
        const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
        const { count } = await supabase.from("ads_impressoes").select("*", { count: "exact", head: true })
          .eq("campanha_id", c.id).eq("user_id", user.id).gte("criado_em", startOfDay.toISOString());
        if ((count ?? 0) < c.frequencia_exibicao) {
          const criativo = c.ads_criativos.filter((cr:any)=>cr.ativo)[0];
          if (!criativo) continue;
          setAd({ campanha: c, criativo });
          await supabase.from("ads_impressoes").insert({ campanha_id: c.id, criativo_id: criativo.id, user_id: user.id, cidade, estado } as never);
          return;
        }
      }
    })();
  }, [user?.id, profile?.plano, tela]);

  if (!ad || closed) return null;
  if (profile?.plano === "premium") return null;

  const onClick = async () => {
    await supabase.from("ads_cliques").insert({ campanha_id: ad.campanha.id, criativo_id: ad.criativo.id, user_id: user?.id } as never);
    if (ad.criativo.url_destino) window.open(ad.criativo.url_destino, "_blank");
  };

  return (
    <Card className="p-2 relative">
      <button onClick={()=>setClosed(true)} className="absolute top-1 right-1 z-10 bg-background/80 rounded-full p-1"><X className="h-3 w-3"/></button>
      <button onClick={onClick} className="block w-full">
        {ad.criativo.tipo === "imagem" && <img src={ad.criativo.url_arquivo} alt="ad" className="w-full rounded"/>}
        {ad.criativo.tipo === "video" && <video src={ad.criativo.url_arquivo} controls className="w-full rounded"/>}
        {ad.criativo.tipo === "html" && <div dangerouslySetInnerHTML={{ __html: ad.criativo.url_arquivo }}/>}
      </button>
      <div className="text-[10px] text-muted-foreground text-center mt-1">Publicidade</div>
    </Card>
  );
}
