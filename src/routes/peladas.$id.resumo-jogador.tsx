import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { calcularTabela } from "@/lib/placar";
import { calcularResumoJogadorPelada, type ResumoJogadorPelada } from "@/lib/resumoJogadorPelada";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { Logo } from "@/components/Logo";
import { Download, Share2, ArrowLeft, Loader2, Clock, Trophy, Target, Shield } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";

export const Route = createFileRoute("/peladas/$id/resumo-jogador")({
  component: Wrapper,
});

function Wrapper() {
  const { user } = useAuth();
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <MobileShell items={getNavItems(user?.role)}><ResumoJogador /></MobileShell>
    </RequireAuth>
  );
}

function ResumoJogador() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<"baixar" | "compartilhar" | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
      const { data: g } = await supabase.from("grupos").select("nome").eq("id", (p as any)?.grupo_id).maybeSingle();
      const { data: perfil } = await supabase.from("profiles").select("nome, foto_url, handle").eq("user_id", user.id).maybeSingle();
      const { data: tj } = await supabase.from("time_jogadores").select("time_id, eh_goleiro").eq("pelada_id", id).eq("user_id", user.id).maybeSingle();

      if (!tj) { setData(null); return; }

      const resumo = await calcularResumoJogadorPelada(id, user.id);

      // Vitórias do time dele nessa pelada — mesma fonte usada no Card da Vitória
      const { data: times } = await supabase.from("times").select("id, nome, cor").eq("pelada_id", id);
      const { data: parts } = await supabase.from("partidas").select("*").eq("pelada_id", id);
      const tabelaObj = calcularTabela((parts as any) || [], (times as any) || []);
      const linhaTime = (tabelaObj as any)[(tj as any).time_id];
      const vitoriasTime = linhaTime?.v ?? 0;
      const partidasTime = (linhaTime?.v ?? 0) + (linhaTime?.e ?? 0) + (linhaTime?.d ?? 0);

      setData({
        pelada: p,
        grupo: g,
        perfil,
        ehGoleiro: !!(tj as any).eh_goleiro,
        resumo,
        vitoriasTime,
        partidasTime,
      });
    })();
  }, [id, user?.id]);

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
      link.download = `mrfut-resumo-${id}.png`;
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
      const file = new File([blob], `mrfut-resumo-${id}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "MRFUT", text: "⚽ Meu resumo da pelada!" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mrfut-resumo-${id}.png`;
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

  const resumo: ResumoJogadorPelada | null = data.resumo;
  const nomePelada = data.pelada?.nome_pelada || data.grupo?.nome || "";
  const dataFormatada = data.pelada?.data ? data.pelada.data.split("-").reverse().join("/") : "";
  const horas = Math.floor((resumo?.minutosJogados || 0) / 60);
  const minutosRestantes = (resumo?.minutosJogados || 0) % 60;
  const tempoTexto = horas > 0 ? `${horas}h${minutosRestantes.toString().padStart(2, "0")}` : `${minutosRestantes} min`;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/peladas/$id", params: { id } })} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="overflow-auto">
        <div
          ref={cardRef}
          style={{
            width: 380, minHeight: 660, background: "radial-gradient(circle at 50% 0%, #132018 0%, #0A0A0A 55%, #050505 100%)",
            color: "#fff", padding: "28px 20px", fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <Logo style={{ height: 30 }} />
          </div>

          <div style={{ textAlign: "center", marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: "#00FF87" }}>MEU RESUMO DA PELADA</div>
            <div style={{ marginTop: 16 }}>
              <div style={{
                width: 88, height: 88, borderRadius: "50%", margin: "0 auto", background: "#222",
                border: "3px solid #00FF87", overflow: "hidden", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 32, fontWeight: 900,
              }}>
                {data.perfil?.foto_url ? (
                  <img src={data.perfil.foto_url} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  data.perfil?.nome?.[0]?.toUpperCase() || "?"
                )}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, marginTop: 10 }}>{data.perfil?.nome}</div>
              {data.perfil?.handle && <div style={{ fontSize: 13, color: "#00FF87", fontWeight: 700 }}>@{data.perfil.handle}</div>}
              {data.ehGoleiro && (
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, padding: "3px 10px",
                  borderRadius: 999, border: "1px solid rgba(0,255,135,0.4)", fontSize: 11, fontWeight: 800,
                }}>
                  🧤 Goleiro
                </div>
              )}
            </div>
          </div>

          {/* grid de estatísticas */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 26 }}>
            <StatBox icon={<Clock size={18} color="#00FF87" />} valor={tempoTexto} label="TEMPO EM CAMPO" />
            <StatBox icon={<Trophy size={18} color="#00FF87" />} valor={`${data.vitoriasTime}`} label={`VITÓRIAS DO TIME${data.partidasTime ? ` (${data.partidasTime}J)` : ""}`} />
            {data.ehGoleiro ? (
              <StatBox icon={<Shield size={18} color="#00FF87" />} valor={`${resumo?.defesas ?? 0}`} label="GOLS DEFENDIDOS" full />
            ) : (
              <StatBox icon={<Target size={18} color="#00FF87" />} valor={`${resumo?.gols ?? 0}`} label="GOLS MARCADOS" full />
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 28, fontSize: 10.5, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
            MRFUT.COM.BR {nomePelada ? `• ${nomePelada.toUpperCase()}` : ""} {dataFormatada ? `• ${dataFormatada}` : ""}
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

function StatBox({ icon, valor, label, full }: { icon: React.ReactNode; valor: string; label: string; full?: boolean }) {
  return (
    <div style={{
      gridColumn: full ? "1 / -1" : undefined,
      border: "1px solid rgba(0,255,135,0.3)", borderRadius: 16, padding: "16px 14px",
      background: "rgba(255,255,255,0.02)", textAlign: "center",
    }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.6)", letterSpacing: 1, marginTop: 6 }}>{label}</div>
    </div>
  );
}
