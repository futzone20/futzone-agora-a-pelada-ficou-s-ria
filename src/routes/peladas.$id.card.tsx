import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { calcularTabela } from "@/lib/placar";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { Logo } from "@/components/Logo";
import { Download, Share2, ArrowLeft, Loader2, Trophy, TrendingUp, Shield, Camera, ImagePlus, CalendarDays, MapPin } from "lucide-react";
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

const MAX_AVATARES = 6;

type Estilo = "classico" | "foto";

function Card() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<"baixar" | "compartilhar" | null>(null);
  const [estilo, setEstilo] = useState<Estilo>("classico");
  const [foto, setFoto] = useState<string | null>(null);
  const galeriaRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
      const { data: g } = await supabase.from("grupos").select("nome").eq("id", (p as any)?.grupo_id).maybeSingle();
      const { data: times } = await supabase.from("times").select("id, nome, cor").eq("pelada_id", id);
      const { data: parts } = await supabase.from("partidas").select("*").eq("pelada_id", id);

      let quadraNome: string | null = null;
      if ((p as any)?.quadra_id) {
        const { data: q } = await supabase.from("quadras_publicas").select("nome").eq("id", (p as any).quadra_id).maybeSingle();
        quadraNome = (q as any)?.nome || null;
      }

      const tabelaObj = calcularTabela((parts as any) || [], (times as any) || []);
      const tabela = Object.values(tabelaObj).sort(
        (a, b) => b.pts - a.pts || b.gp - b.gc - (a.gp - a.gc),
      );

      const primeiro: any = tabela[0];
      const venc = primeiro?.time_id || null;
      const vitorias = primeiro?.v ?? 0;
      const partidasTime = (primeiro?.v ?? 0) + (primeiro?.e ?? 0) + (primeiro?.d ?? 0);

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

      let listaProfs = [...(profs || [])];
      if (artilheiroUid) {
        listaProfs.sort((a: any, b: any) => (a.user_id === artilheiroUid ? -1 : b.user_id === artilheiroUid ? 1 : 0));
      }

      setData({
        pelada: p,
        grupo: g,
        time,
        profs: listaProfs,
        vitorias,
        partidasTime,
        artilheiroUid,
        quadraNome,
      });
    })();
  }, [id]);

  const escolherFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFoto(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

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
        await navigator.share({ files: [file], title: "MRFUT", text: "🏆 O time mais vitorioso da pelada!" });
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

  const cor = data.time.cor || "#00FF87";
  const avataresVisiveis = data.profs.slice(0, MAX_AVATARES);
  const restantes = data.profs.length - avataresVisiveis.length;
  const nomePelada = data.pelada?.nome_pelada || data.grupo?.nome || "";
  const dataFormatada = data.pelada?.data ? data.pelada.data.split("-").reverse().join("/") : "";

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/peladas/$id", params: { id } })} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>

      <div className="flex gap-2">
        <button
          onClick={() => setEstilo("classico")}
          className={`flex-1 rounded-lg border py-2 text-xs font-bold ${estilo === "classico" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
        >
          🏆 Estilo Clássico
        </button>
        <button
          onClick={() => setEstilo("foto")}
          className={`flex-1 rounded-lg border py-2 text-xs font-bold ${estilo === "foto" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
        >
          📸 Com foto/selfie
        </button>
      </div>

      {estilo === "foto" && (
        <div className="flex gap-2">
          <input ref={galeriaRef} type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
          <input ref={selfieRef} type="file" accept="image/*" capture="user" className="hidden" onChange={escolherFoto} />
          <Button variant="outline" className="flex-1" onClick={() => galeriaRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" /> Escolher da galeria
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => selfieRef.current?.click()}>
            <Camera className="mr-2 h-4 w-4" /> Tirar selfie
          </Button>
        </div>
      )}

      <div className="overflow-auto">
        {estilo === "classico" ? (
          <div
            ref={cardRef}
            style={{
              width: 380, minHeight: 700, background: "radial-gradient(circle at 50% 0%, #132018 0%, #0A0A0A 55%, #050505 100%)",
              color: "#fff", padding: "28px 20px", fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <Logo style={{ height: 30 }} />
            </div>

            <div style={{ textAlign: "center", marginTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color: "#fff" }}>
                <span style={{ color: "#00FF87" }}>★</span> TIME MR. DA PELADA <span style={{ color: "#00FF87" }}>★</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginTop: 6, letterSpacing: 1 }}>O MAIS</div>
              <div style={{
                fontSize: 44, fontWeight: 900, color: "#00FF87", fontStyle: "italic", lineHeight: 1,
                marginTop: 2, transform: "skewX(-6deg)", textShadow: "0 4px 18px rgba(0,255,135,0.35)",
              }}>
                VITORIOSO!
              </div>
              <div style={{ width: 150, height: 3, background: "#00FF87", margin: "10px auto 0", borderRadius: 4 }} />
            </div>

            <div style={{
              marginTop: 24, border: "1px solid rgba(0,255,135,0.35)", borderRadius: 20, padding: "28px 20px 20px",
              background: "rgba(255,255,255,0.02)", position: "relative",
            }}>
              <div style={{
                position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)",
                width: 44, height: 44, borderRadius: "50%", background: "#0A0A0A", border: "2px solid #00FF87",
                display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(0,255,135,0.4)",
              }}>
                <Trophy size={20} color="#00FF87" />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 6 }}>
                <div style={{ fontSize: 64, fontWeight: 900, color: "#00FF87", lineHeight: 1 }}>{data.vitorias}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#00FF87", letterSpacing: 1 }}>MAIS VITÓRIAS</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>VITÓRIAS</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.6)" }}>
                    EM <span style={{ color: "#00FF87", fontWeight: 800 }}>{data.partidasTime}</span> PARTIDAS
                  </div>
                </div>
              </div>

              {data.partidasTime > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
                  {Array.from({ length: data.partidasTime }).map((_, i) => (
                    <div key={i} style={{
                      flex: 1, height: 6, borderRadius: 4,
                      background: i < data.vitorias ? "#00FF87" : "rgba(255,255,255,0.15)",
                    }} />
                  ))}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(0,255,135,0.5)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <TrendingUp size={15} color="#00FF87" />
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.3 }}>
                  <span style={{ color: "#fff" }}>A consistência que faz a diferença. </span>
                  <span style={{ color: "#00FF87", fontWeight: 800 }}>Seguimos juntos!</span>
                </div>
              </div>
            </div>

            <div style={{
              marginTop: 20, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, padding: "16px 12px",
            }}>
              <div style={{ textAlign: "center", fontSize: 12, fontWeight: 800, letterSpacing: 2, color: "rgba(255,255,255,0.85)", marginBottom: 14 }}>
                DESTAQUES DO TIME
              </div>
              <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
                {avataresVisiveis.map((p: any) => {
                  const ehArtilheiro = p.user_id === data.artilheiroUid;
                  const souEu = p.user_id === user?.id;
                  return (
                    <div key={p.user_id} style={{ textAlign: "center", width: 58, position: "relative" }}>
                      {ehArtilheiro && (
                        <div style={{ fontSize: 16, position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)" }}>👑</div>
                      )}
                      <div style={{
                        width: 52, height: 52, borderRadius: "50%", background: "#222", margin: "0 auto",
                        border: `2px solid ${ehArtilheiro ? "#FFD700" : souEu ? "#00FF87" : cor}`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, overflow: "hidden",
                      }}>
                        {p.foto_url ? (
                          <img src={p.foto_url} alt={p.nome} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          p.nome?.[0]?.toUpperCase() || "?"
                        )}
                      </div>
                      <div style={{
                        fontSize: 10, marginTop: 5, fontWeight: 700, color: "#fff", lineHeight: 1.2,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {p.nome?.split(" ")[0]}{p.nome?.split(" ")[1] ? <><br />{p.nome.split(" ")[1]}</> : null}
                      </div>
                    </div>
                  );
                })}
                {restantes > 0 && (
                  <div style={{ textAlign: "center", width: 58 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: "50%", background: "rgba(0,255,135,0.12)", margin: "0 auto",
                      border: "2px solid rgba(0,255,135,0.4)", display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, fontSize: 15, color: "#00FF87",
                    }}>
                      +{restantes}
                    </div>
                    <div style={{ fontSize: 9, marginTop: 5, fontWeight: 700, color: "rgba(255,255,255,0.6)", lineHeight: 1.2 }}>
                      e outros<br />jogadores
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{
              marginTop: 18, border: "1px solid rgba(0,255,135,0.35)", borderRadius: 18, padding: "16px 18px",
              display: "flex", alignItems: "center", gap: 14, position: "relative", overflow: "hidden",
            }}>
              <Shield size={30} color="#00FF87" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.3 }}>
                <span style={{ color: "#fff" }}>BRABOS </span>
                <span style={{ color: "#00FF87" }}>EM</span>
                <span style={{ color: "#fff" }}> CAMPO,</span>
                <br />
                <span style={{ color: "#00FF87" }}>LENDÁRIOS NA RESENHA!</span>
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: 20, fontSize: 10.5, color: "rgba(255,255,255,0.45)", letterSpacing: 1 }}>
              MRFUT.COM.BR {nomePelada ? `• ${nomePelada.toUpperCase()}` : ""}
            </div>
          </div>
        ) : (
          <div
            ref={cardRef}
            style={{
              width: 380, minHeight: 700, position: "relative", overflow: "hidden",
              fontFamily: "system-ui, sans-serif", color: "#fff", backgroundColor: "#0A0A0A",
            }}
          >
            {foto ? (
              <img src={foto} crossOrigin="anonymous" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#0D0D0D 0%,#1a1a2e 100%)" }} />
            )}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.35) 65%, rgba(0,0,0,0.92) 100%)" }} />

            <div style={{ position: "relative", padding: "26px 22px 0" }}>
              <Logo style={{ height: 26 }} />

              <div style={{ marginTop: 22, fontSize: 13, fontWeight: 800, letterSpacing: 3, color: "#00FF87" }}>
                TIME MR. DA PELADA
              </div>

              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
                <span style={{ fontSize: 58, fontWeight: 900, color: "#00FF87", lineHeight: 1, fontStyle: "italic" }}>{data.vitorias}</span>
                <span style={{ fontSize: 44, fontWeight: 900, color: "#fff", lineHeight: 1, fontStyle: "italic" }}>vitórias</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 2 }}>
                em <span style={{ color: "#00FF87" }}>{data.partidasTime}</span> partidas
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
                <div style={{ width: 3, height: 18, background: "#00FF87", borderRadius: 2 }} />
                <div style={{ fontSize: 15 }}>
                  <span style={{ fontWeight: 900, color: "#fff" }}>Maior vencedor</span>{" "}
                  <span style={{ color: "rgba(255,255,255,0.75)" }}>da pelada</span>
                </div>
              </div>
            </div>

            <div style={{ position: "absolute", left: 0, right: 0, bottom: 96, padding: "0 22px" }}>
              <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
                {avataresVisiveis.map((p: any) => {
                  const ehArtilheiro = p.user_id === data.artilheiroUid;
                  return (
                    <div key={p.user_id} style={{ width: 56, height: 56, borderRadius: "50%", overflow: "hidden", border: `2.5px solid ${ehArtilheiro ? "#FFD700" : "#00FF87"}`, background: "#222" }}>
                      {p.foto_url ? (
                        <img src={p.foto_url} crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{p.nome?.[0]}</div>
                      )}
                    </div>
                  );
                })}
                {restantes > 0 && (
                  <div style={{
                    width: 56, height: 56, borderRadius: "50%", border: "2.5px solid #fff", background: "rgba(0,0,0,0.6)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 16, color: "#fff",
                  }}>
                    +{restantes}
                  </div>
                )}
              </div>
            </div>

            <div style={{ position: "absolute", left: 0, right: 0, bottom: 20, padding: "0 22px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {(nomePelada || dataFormatada) && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(0,255,135,0.5)", borderRadius: 999,
                  padding: "6px 16px", fontSize: 12.5, fontWeight: 700,
                }}>
                  <CalendarDays size={14} color="#00FF87" />
                  <span>{nomePelada}{dataFormatada ? ` • ${dataFormatada}` : ""}</span>
                </div>
              )}
              {data.quadraNome && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  <MapPin size={12} color="rgba(255,255,255,0.6)" />
                  <span>{data.quadraNome}</span>
                </div>
              )}
            </div>
          </div>
        )}
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
