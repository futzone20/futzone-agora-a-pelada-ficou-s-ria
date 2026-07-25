import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ImagePlus, Download, Share2, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import type { LinhaRankingPelada } from "@/lib/rankingPelada";

type Estilo = "colorido" | "minimalista";

export function CompartilharPodio({
  open, onOpenChange, linhas, peladaNome, data, meuId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  linhas: LinhaRankingPelada[];
  peladaNome: string;
  data: string;
  meuId: string | undefined;
}) {
  const [foto, setFoto] = useState<string | null>(null);
  const [estilo, setEstilo] = useState<Estilo>("colorido");
  const [busy, setBusy] = useState<"baixar" | "compartilhar" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [primeiro, segundo, terceiro] = linhas;
  const dataFormatada = data.split("-").reverse().join("/");

  const escolherFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFoto(reader.result as string);
    reader.readAsDataURL(file);
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
      link.download = "mrfut-ranking.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar a imagem.");
    } finally { setBusy(null); }
  };

  const compartilhar = async () => {
    setBusy("compartilhar");
    try {
      const canvas = await gerarCanvas();
      if (!canvas) return;
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 1));
      if (!blob) throw new Error("Falha ao gerar imagem");
      const file = new File([blob], "mrfut-ranking.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "MrFut", text: "🏆 Ranking da pelada!" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "mrfut-ranking.png"; a.click();
        URL.revokeObjectURL(url);
        toast.info("Compartilhamento direto não é suportado aqui — imagem baixada.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar a imagem pra compartilhar.");
    } finally { setBusy(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Compartilhar Ranking</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={escolherFoto} />
          <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" /> {foto ? "Trocar foto" : "Tirar selfie ou escolher foto"}
          </Button>

          <div className="flex gap-2">
            <button
              onClick={() => setEstilo("colorido")}
              className={`flex-1 rounded-lg border py-2 text-xs font-bold ${estilo === "colorido" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
            >
              🏆 Estilo Pódio
            </button>
            <button
              onClick={() => setEstilo("minimalista")}
              className={`flex-1 rounded-lg border py-2 text-xs font-bold ${estilo === "minimalista" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
            >
              ⚪ Minimalista
            </button>
          </div>

          <div className="flex justify-center overflow-hidden rounded-xl">
            <div
              ref={cardRef}
              style={{
                width: 270, height: 540, position: "relative", fontFamily: "system-ui, sans-serif",
                backgroundColor: "#0D0D0D", overflow: "hidden",
              }}
            >
              {foto ? (
                <img src={foto} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#0D0D0D 0%,#1a1a2e 100%)" }} />
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.75) 100%)" }} />

              <div style={{ position: "relative", padding: "20px 16px 0", textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}>Ranking do dia</div>
                <div style={{ fontSize: 12, color: "#00FF87", fontWeight: 700, marginTop: 2 }}>{peladaNome} · {dataFormatada}</div>
              </div>

              <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, padding: "0 14px" }}>
                {estilo === "colorido" ? (
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 6 }}>
                    <BlocoColorido l={segundo} posicao={2} meuId={meuId} />
                    <BlocoColorido l={primeiro} posicao={1} meuId={meuId} />
                    <BlocoColorido l={terceiro} posicao={3} meuId={meuId} />
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 14 }}>
                    <BlocoMinimalista l={segundo} posicao={2} meuId={meuId} />
                    <BlocoMinimalista l={primeiro} posicao={1} meuId={meuId} />
                    <BlocoMinimalista l={terceiro} posicao={3} meuId={meuId} />
                  </div>
                )}
              </div>

              <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, opacity: 0.85 }}>
                <Logo style={{ height: 16, width: "auto" }} />
                <span style={{ fontSize: 8, letterSpacing: 1, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>www.mrfut.com.br</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={baixar} disabled={!!busy}>
              {busy === "baixar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />} Baixar
            </Button>
            <Button className="flex-1 bg-primary text-primary-foreground font-bold hover:bg-primary/90" onClick={compartilhar} disabled={!!busy}>
              {busy === "compartilhar" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />} Compartilhar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BlocoColorido({ l, posicao, meuId }: { l: LinhaRankingPelada; posicao: 1 | 2 | 3; meuId: string | undefined }) {
  const cor = posicao === 1 ? "#00FF87" : posicao === 2 ? "#C0C0C0" : "#CD7F32";
  const altura = posicao === 1 ? 62 : posicao === 2 ? 44 : 32;
  const tamanhoFoto = posicao === 1 ? 52 : 40;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 72 }}>
      <div style={{
        width: tamanhoFoto, height: tamanhoFoto, borderRadius: "50%", border: `2px solid ${cor}`,
        overflow: "hidden", backgroundColor: "#2A2A2A", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 4,
      }}>
        {l.foto_url ? <img src={l.foto_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : l.nome[0]}
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, color: "#fff", textAlign: "center", maxWidth: 68, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {l.nome}{l.user_id === meuId ? " ⭐" : ""}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: cor }}>{l.pontos} pts</div>
      <div style={{
        marginTop: 4, width: "100%", height: altura, borderRadius: "8px 8px 0 0",
        backgroundColor: `${cor}33`, border: `1px solid ${cor}`, display: "flex", alignItems: "flex-start", justifyContent: "center",
      }}>
        <span style={{ marginTop: 4, fontSize: 16, fontWeight: 900, color: cor }}>{posicao}º</span>
      </div>
    </div>
  );
}

function BlocoMinimalista({ l, posicao, meuId }: { l: LinhaRankingPelada; posicao: 1 | 2 | 3; meuId: string | undefined }) {
  const tamanho = posicao === 1 ? 64 : 50;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 72, marginBottom: posicao === 1 ? 0 : 10 }}>
      <div style={{ position: "relative" }}>
        <div style={{
          width: tamanho, height: tamanho, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.8)",
          overflow: "hidden", backgroundColor: "#2A2A2A", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 900, color: "#fff",
        }}>
          {l.foto_url ? <img src={l.foto_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : l.nome[0]}
        </div>
        <div style={{
          position: "absolute", bottom: -4, right: -4, width: 20, height: 20, borderRadius: "50%",
          backgroundColor: "#fff", color: "#0D0D0D", fontSize: 11, fontWeight: 900,
          display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0D0D0D",
        }}>
          {posicao}
        </div>
      </div>
      <div style={{ marginTop: 6, fontSize: 10, fontWeight: 800, color: "#fff", textAlign: "center", maxWidth: 68, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {l.nome}{l.user_id === meuId ? " ⭐" : ""}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.75)" }}>{l.pontos} pts</div>
    </div>
  );
}
