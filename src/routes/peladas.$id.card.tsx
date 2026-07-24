import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { calcularTabela } from "@/lib/placar";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { Download, Share2, ArrowLeft, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";

export const Route = createFileRoute("/peladas/$id/card")({
  component: Wrapper,
});

function Wrapper() {
  const { user } = useAuth();
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <MobileShell items={getNavItems(user?.role)}><Card /></MobileShell>
    </RequireAuth>
  );
}

function Card() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<"baixar" | "compartilhar" | null>(null);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
      const { data: g } = await supabase.from("grupos").select("nome").eq("id", (p as any)?.grupo_id).maybeSingle();
      const { data: times } = await supabase.from("times").select("id, nome, cor").eq("pelada_id", id);
      const { data: parts } = await supabase.from("partidas").select("*").eq("pelada_id", id);

      const tabela = Object.values(calcularTabela((parts as any) || [], (times as any) || [])).sort(
        (a, b) => b.pts - a.pts || b.gp - b.gc - (a.gp - a.gc),
      );

      const primeiro = tabela[0];
      const segundo = tabela[1];
      const venc = primeiro?.time_id || null;

      const { data: time } = venc ? await supabase.from("times").select("*").eq("id", venc).maybeSingle() : { data: null } as any;
      const { data: tj } = venc ? await supabase.from("time_jogadores").select("user_id").eq("time_id", venc) : { data: [] } as any;
      const uids = (tj || []).map((x: any) => x.user_id);
      const { data: profs } = uids.length
        ? await supabase.from("profiles").select("user_id, nome, foto_url").in("user_id", uids)
        : { data: [] } as any;

      const { data: lances } = await supabase.from("lances").select("user_id,tipo").eq("pelada_id", id);
      const gols: Record<string, number> = {};
      (lances || []).forEach((l: any) => { if (l.tipo === "gol") gols[l.user_id] = (gols[l.user_id] || 0) + 1; });
      const artilheiroUid = Object.keys(gols).sort((a, b) => gols[b] - gols[a])[0];
      const artilheiro = artilheiroUid ? { nome: (profs || []).find((x: any) => x.user_id === artilheiroUid)?.nome, gols: gols[artilheiroUid] } : null;

      const mvpUid = (p as any)?.mvp_user_id;
      const { data: mvpProf } = mvpUid ? await supabase.from("profiles").select("nome").eq("user_id", mvpUid).maybeSingle() : { data: null } as any;

      // Placar só faz sentido literalmente com 2 times (vitórias de cada um).
      // Com 3+ times (rodízio), mostramos quantas vitórias o time campeão teve.
      const placarLabel =
        (times || []).length <= 2 && segundo
          ? `${primeiro.v} x ${segundo.v}`
          : `${primeiro?.v ?? 0} ${primeiro?.v === 1 ? "vitória" : "vitórias"}`;

      setData({
        pelada: p,
        grupo: g,
        time,
        profs: profs || [],
        placar: placarLabel,
        artilheiro,
        mvp: mvpProf,
      });
    })();
  }, [id]);

  const gerarCanvas = async () => {
    if (!cardRef.current) return null;
    return html2canvas(cardRef.current, { backgroundColor: null, scale: 2, useCORS: true });
  };

  const baixar = async () => {
    setBusy("baixar");
    try {
      const canvas = await gerarCanvas();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `mrfut-vitoria-${id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar o card.");
    } finally {
      setBusy(null);
    }
  };

  const compartilhar = async () => {
    setBusy("compartilhar");
    try {
      const canvas = await gerarCanvas();
      if (!canvas) return;
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 1));
      if (!blob) throw new Error("Falha ao gerar imagem");
      const file = new File([blob], `mrfut-vitoria-${id}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "MRFUT", text: "🏆 Vitória na pelada!" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mrfut-vitoria-${id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info("Compartilhamento direto não é suportado aqui — imagem baixada.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar o card para compartilhar.");
    } finally {
      setBusy(null);
    }
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
          <div style={{ textAlign: "center", fontSize: 14, letterSpacing: 4, color: "#10b981", fontWeight: 900 }}>MRFUT</div>
          <div style={{ textAlign: "center", fontSize: 42, fontWeight: 900, color: "#10b981", marginTop: 12 }}>🏆 VITÓRIA!</div>
          <div style={{ textAlign: "center", fontSize: 20, fontWeight: 700, color: cor, marginTop: 8 }}>{data.time.nome}</div>
          <div style={{ background: `${cor}33`, borderRadius: 16, padding: 16, margin: "16px 0", textAlign: "center" }}>
            <div style={{ fontSize: data.placar.length > 8 ? 32 : 56, fontWeight: 900 }}>{data.placar}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {data.profs.map((p: any) => {
              const souEu = p.user_id === user?.id;
              return (
                <div key={p.user_id} style={{ textAlign: "center", width: 60 }}>
                  <div
                    style={{
                      width: 48, height: 48, borderRadius: "50%", background: "#222", margin: "0 auto",
                      border: `2px solid ${souEu ? "#00FF87" : cor}`, display: "flex", alignItems: "center",
                      justifyContent: "center", fontWeight: 700, overflow: "hidden",
                    }}
                  >
                    {p.foto_url ? (
                      <img
                        src={p.foto_url}
                        alt={p.nome}
                        crossOrigin="anonymous"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      p.nome?.[0]?.toUpperCase() || "?"
                    )}
                  </div>
                  <div style={{ fontSize: 10, marginTop: 4, fontWeight: souEu ? 900 : 400, color: souEu ? "#00FF87" : "#fff" }}>
                    {p.nome}{souEu ? " (você)" : ""}
                  </div>
                </div>
              );
            })}
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
            mrfut.app · {data.grupo?.nome} · {data.pelada.data?.split("-").reverse().join("/")}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={compartilhar} disabled={busy !== null} className="flex-1 bg-primary font-bold">
          {busy === "compartilhar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
          Compartilhar
        </Button>
        <Button onClick={baixar} disabled={busy !== null} variant="outline" className="flex-1 font-bold">
          {busy === "baixar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Baixar
        </Button>
      </div>
    </div>
  );
}
