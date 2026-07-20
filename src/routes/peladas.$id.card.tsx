import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { Home, CircleDot, Trophy, User, Download, ArrowLeft } from "lucide-react";
import html2canvas from "html2canvas";

export const Route = createFileRoute("/peladas/$id/card")({
  component: Wrapper,
});

const items = [
  { to: "/jogador", label: "Início", icon: Home },
  { to: "/jogador/peladas", label: "Peladas", icon: CircleDot },
  { to: "/jogador/ranking", label: "Ranking", icon: Trophy },
  { to: "/jogador/perfil", label: "Perfil", icon: User },
];

function Wrapper() {
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <MobileShell items={items as any}><Card /></MobileShell>
    </RequireAuth>
  );
}

function Card() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
      const { data: g } = await supabase.from("grupos").select("nome").eq("id", (p as any)?.grupo_id).maybeSingle();
      const { data: parts } = await supabase.from("partidas").select("*").eq("pelada_id", id).eq("status", "encerrada");
      const va = (parts || []).filter((x: any) => x.placar_a > x.placar_b).length;
      const vb = (parts || []).filter((x: any) => x.placar_b > x.placar_a).length;
      const firstP: any = (parts || [])[0];
      const venc = firstP ? (va >= vb ? firstP.time_a_id : firstP.time_b_id) : null;
      const { data: time } = venc ? await supabase.from("times").select("*").eq("id", venc).maybeSingle() : { data: null } as any;
      const { data: tj } = venc ? await supabase.from("time_jogadores").select("user_id").eq("time_id", venc) : { data: [] } as any;
      const uids = (tj || []).map((x: any) => x.user_id);
      const { data: profs } = uids.length ? await supabase.from("profiles").select("user_id,nome").in("user_id", uids) : { data: [] } as any;
      const { data: lances } = await supabase.from("lances").select("user_id,tipo").eq("pelada_id", id);
      const gols: Record<string, number> = {};
      (lances || []).forEach((l: any) => { if (l.tipo === "gol") gols[l.user_id] = (gols[l.user_id] || 0) + 1; });
      const artilheiroUid = Object.keys(gols).sort((a, b) => gols[b] - gols[a])[0];
      const artilheiro = artilheiroUid ? { nome: (profs || []).find((x: any) => x.user_id === artilheiroUid)?.nome, gols: gols[artilheiroUid] } : null;
      const mvpUid = (p as any)?.mvp_user_id;
      const { data: mvpProf } = mvpUid ? await supabase.from("profiles").select("nome").eq("user_id", mvpUid).maybeSingle() : { data: null } as any;
      setData({ pelada: p, grupo: g, time, profs: profs || [], placar: `${va} x ${vb}`, artilheiro, mvp: mvpProf });
    })();
  }, [id]);

  const baixar = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 });
    const link = document.createElement("a");
    link.download = `futzone-vitoria-${id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  if (!data) return <div className="text-sm text-muted-foreground">Gerando card...</div>;
  if (!data.time) return <div className="text-sm text-muted-foreground">Sem partidas encerradas — card indisponível.</div>;

  const cor = data.time.cor || "#FFD700";

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/peladas/$id", params: { id } })} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div className="overflow-auto">
        <div ref={cardRef} style={{
          width: 360, minHeight: 640, background: "linear-gradient(180deg,#0D0D0D 0%,#1a1a2e 100%)",
          color: "#fff", padding: 24, fontFamily: "system-ui, sans-serif", position: "relative",
        }}>
          <div style={{ textAlign: "center", fontSize: 14, letterSpacing: 4, color: "#10b981", fontWeight: 900 }}>FUTZONE</div>
          <div style={{ textAlign: "center", fontSize: 42, fontWeight: 900, color: "#10b981", marginTop: 12 }}>🏆 VITÓRIA!</div>
          <div style={{ textAlign: "center", fontSize: 20, fontWeight: 700, color: cor, marginTop: 8 }}>{data.time.nome}</div>
          <div style={{ background: `${cor}33`, borderRadius: 16, padding: 16, margin: "16px 0", textAlign: "center" }}>
            <div style={{ fontSize: 56, fontWeight: 900 }}>{data.placar}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {data.profs.map((p: any) => (
              <div key={p.user_id} style={{ textAlign: "center", width: 60 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#222", margin: "0 auto", border: `2px solid ${cor}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  {p.nome?.[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ fontSize: 10, marginTop: 4 }}>{p.nome}</div>
              </div>
            ))}
          </div>
          {data.artilheiro && (
            <div style={{ marginTop: 16, padding: 8, background: "#10b98122", borderRadius: 8, textAlign: "center", fontSize: 13 }}>
              ⚽ Artilheiro: <b>{data.artilheiro.nome}</b> — {data.artilheiro.gols} gols
            </div>
          )}
          {data.mvp && (
            <div style={{ marginTop: 8, padding: 8, background: "#fbbf2422", borderRadius: 8, textAlign: "center", fontSize: 13 }}>
              ⭐ MVP: <b>{data.mvp.nome}</b>
            </div>
          )}
          <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", fontSize: 11, color: "#888" }}>
            futzone.app · {data.grupo?.nome} · {data.pelada.data?.split("-").reverse().join("/")}
          </div>
        </div>
      </div>
      <Button onClick={baixar} className="w-full bg-primary font-bold">
        <Download className="mr-2 h-4 w-4" /> Baixar Card
      </Button>
    </div>
  );
}
