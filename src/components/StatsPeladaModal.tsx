import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import {
  X,
  Users,
  CalendarDays,
  Hand,
  Shield,
  Play,
  Share2,
  Trophy,
  BarChart3,
  Loader2,
} from "lucide-react";

type Time = { id: string; nome: string; cor: string };
type Partida = {
  id: string;
  numero_partida: number;
  time_a_id: string;
  time_b_id: string;
  placar_a: number;
  placar_b: number;
  encerrada_em: string | null;
};
type Lance = { id: string; tipo: string; user_id: string; time_id: string; partida_id: string; criado_em: string };

type TabId = "times" | "artilheiros" | "partidas" | "goleiros";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "times", label: "Times", icon: <Users className="h-5 w-5" /> },
  { id: "artilheiros", label: "Artilheiros", icon: <SoccerBallIcon className="h-5 w-5" /> },
  { id: "partidas", label: "Partidas", icon: <CalendarDays className="h-5 w-5" /> },
  { id: "goleiros", label: "Goleiros", icon: <Hand className="h-5 w-5" /> },
];

const FOOTER_TEXT: Record<TabId, string> = {
  times: "Acompanhe o desempenho dos times e a disputa pela vitória!",
  artilheiros: "Acompanhe os artilheiros da pelada e quem está decidindo os jogos!",
  partidas: "Reviva os confrontos e o resultado de cada partida da pelada!",
  goleiros: "Acompanhe o desempenho dos goleiros e quem segura (ou não) a bronca!",
};

function SoccerBallIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7.2 15.4 9.6 14.1 13.6H9.9L8.6 9.6 12 7.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 3.6V7.2M8.6 9.6 4.6 8.4M9.9 13.6 6.8 17.3M14.1 13.6 17.2 17.3M15.4 9.6 19.4 8.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function GlowUnderline({ className = "" }: { className?: string }) {
  return <div className={`h-px rounded-full bg-primary shadow-[0_0_10px_2px_rgba(0,255,135,0.7)] ${className}`} />;
}

export function StatsPeladaModal({
  open,
  onOpenChange,
  peladaId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  peladaId: string;
}) {
  const { user } = useAuth();
  const [times, setTimes] = useState<Time[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [lances, setLances] = useState<Lance[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [peladaInfo, setPeladaInfo] = useState<{ nome: string; data: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<TabId>("times");
  const [expandedPartida, setExpandedPartida] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const storyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      const [{ data: t }, { data: p }, { data: l }, { data: pel }] = await Promise.all([
        supabase.from("times").select("id, nome, cor").eq("pelada_id", peladaId),
        supabase.from("partidas").select("*").eq("pelada_id", peladaId).eq("status", "encerrada").order("numero_partida"),
        supabase.from("lances").select("*").eq("pelada_id", peladaId),
        supabase.from("peladas").select("nome_pelada, data").eq("id", peladaId).single(),
      ]);
      setTimes((t as any) || []);
      setPartidas((p as any) || []);
      setLances((l as any) || []);
      if (pel) setPeladaInfo({ nome: (pel as any).nome_pelada, data: (pel as any).data });
      const uids = Array.from(new Set(((l as any) || []).map((x: any) => x.user_id).filter(Boolean))) as string[];
      if (uids.length) {
        const { data: prs } = await supabase.from("profiles").select("user_id, nome").in("user_id", uids);
        const map: Record<string, string> = {};
        (prs || []).forEach((x: any) => {
          map[x.user_id] = x.nome || "Jogador";
        });
        setProfiles(map);
      }
      setLoading(false);
    })();
  }, [open, peladaId]);

  const tabela = useMemo(
    () =>
      times
        .map((t) => {
          let v = 0,
            e = 0,
            d = 0,
            gm = 0,
            gs = 0;
          for (const p of partidas) {
            let fav = 0,
              con = 0;
            if (p.time_a_id === t.id) {
              fav = p.placar_a;
              con = p.placar_b;
            } else if (p.time_b_id === t.id) {
              fav = p.placar_b;
              con = p.placar_a;
            } else continue;
            gm += fav;
            gs += con;
            if (fav > con) v++;
            else if (fav === con) e++;
            else d++;
          }
          return { ...t, v, e, d, gm, gs, pts: v * 3 + e };
        })
        .sort((a, b) => b.pts - a.pts || b.gm - b.gs - (a.gm - a.gs)),
    [times, partidas],
  );

  const artilheiros = useMemo(() => {
    const golsPorUser: Record<string, number> = {};
    lances
      .filter((l) => l.tipo === "gol" && l.user_id)
      .forEach((l) => {
        golsPorUser[l.user_id] = (golsPorUser[l.user_id] || 0) + 1;
      });
    return Object.entries(golsPorUser)
      .map(([uid, gols]) => ({ uid, nome: profiles[uid] || "Jogador", gols }))
      .sort((a, b) => b.gols - a.gols);
  }, [lances, profiles]);

  const goleiros = useMemo(() => {
    const sofridosPorUser: Record<string, number> = {};
    lances
      .filter((l) => l.tipo === "frango" && l.user_id)
      .forEach((l) => {
        sofridosPorUser[l.user_id] = (sofridosPorUser[l.user_id] || 0) + 1;
      });
    return Object.entries(sofridosPorUser)
      .map(([uid, sofridos]) => ({ uid, nome: profiles[uid] || "Goleiro", sofridos }))
      .sort((a, b) => a.sofridos - b.sofridos);
  }, [lances, profiles]);

  const menosVazado = goleiros[0] || null;
  const maisVazado = goleiros.length > 1 ? goleiros[goleiros.length - 1] : null;

  const timeNome = (id: string) => times.find((t) => t.id === id)?.nome || "Time";
  const timeCor = (id: string) => times.find((t) => t.id === id)?.cor || "#00FF87";

  const handleShare = async () => {
    if (!storyRef.current) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(storyRef.current, {
        backgroundColor: "#0D0D0D",
        scale: 2.7,
        useCORS: true,
      });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 1));
      if (!blob) throw new Error("Falha ao gerar imagem");
      const file = new File([blob], `mrfut-${tab}.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "MRFUT", text: "Estatísticas da pelada 🔥" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `mrfut-${tab}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info("Compartilhamento direto não é suportado aqui — imagem baixada.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível gerar a imagem para compartilhar.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-md gap-0 rounded-3xl border border-primary/30 bg-[#0D0D0D] p-0 shadow-[0_0_50px_rgba(0,255,135,0.12)] [&>button]:hidden">
        <DialogTitle className="sr-only">Estatísticas da Pelada</DialogTitle>

        <div className="max-h-[88vh] overflow-y-auto p-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/40">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold leading-tight text-white">Estatísticas da Pelada</h2>
                <GlowUnderline className="mt-1 w-24" />
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/50 text-primary shadow-[0_0_14px_rgba(0,255,135,0.35)] transition-colors hover:bg-primary/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <>
              {/* Tabs */}
              <div className="mt-5 grid grid-cols-4 gap-2">
                {TABS.map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-3 transition-all ${
                        active
                          ? "border-primary/60 bg-primary/10 text-primary shadow-[0_0_16px_rgba(0,255,135,0.3)]"
                          : "border-white/10 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {t.icon}
                      <span className="text-[11px] font-semibold">{t.label}</span>
                      {active && <GlowUnderline className="w-8" />}
                    </button>
                  );
                })}
              </div>

              {/* Share button */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                >
                  {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
                  Compartilhar
                </button>
              </div>

              {/* Content card */}
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                {tab === "times" && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="pb-3 text-left font-medium">#</th>
                        <th className="pb-3 text-left font-medium">Time</th>
                        <th className="pb-3 font-medium">V</th>
                        <th className="pb-3 font-medium">E</th>
                        <th className="pb-3 font-medium">D</th>
                        <th className="pb-3 font-medium">GM</th>
                        <th className="pb-3 font-medium">GS</th>
                        <th className="pb-3 font-medium text-primary">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabela.map((t, i) => (
                        <tr key={t.id} className="border-t border-white/10">
                          <td className="py-3 font-semibold text-white">{i + 1}º</td>
                          <td className="py-3">
                            <span className="inline-flex items-center gap-2 font-medium text-white">
                              <span className="h-3 w-3 rounded-full border border-white/20" style={{ background: t.cor }} />
                              {t.nome}
                            </span>
                          </td>
                          <td className="py-3 text-center text-white/80">{t.v}</td>
                          <td className="py-3 text-center text-white/80">{t.e}</td>
                          <td className="py-3 text-center text-white/80">{t.d}</td>
                          <td className="py-3 text-center text-white/80">{t.gm}</td>
                          <td className="py-3 text-center text-white/80">{t.gs}</td>
                          <td className="py-3 text-center text-lg font-extrabold text-primary">{t.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {tab === "artilheiros" &&
                  (artilheiros.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum gol registrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {artilheiros.map((a, i) => {
                        const souEu = a.uid === user?.id;
                        return (
                          <div
                            key={a.uid}
                            className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                              i === 0
                                ? "border border-primary/60 bg-primary/10 shadow-[0_0_18px_rgba(0,255,135,0.22)]"
                                : souEu
                                  ? "border border-white/20 bg-white/[0.07]"
                                  : "bg-white/5"
                            }`}
                          >
                            <span className="flex items-center gap-3">
                              <span className={`font-bold ${i === 0 ? "text-primary" : "text-muted-foreground"}`}>{i + 1}º</span>
                              {i === 0 && (
                                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/60 bg-primary/10">
                                  <SoccerBallIcon className="h-4 w-4 text-primary" />
                                </span>
                              )}
                              <span className={i === 0 ? "font-bold text-white" : souEu ? "font-bold text-white" : "font-medium text-white/90"}>
                                {a.nome}
                                {souEu && <span className="ml-1.5 text-[10px] font-semibold text-primary">(você)</span>}
                              </span>
                            </span>
                            <span className={`text-lg font-extrabold ${i === 0 ? "text-primary" : "text-white"}`}>
                              {a.gols} <span className="text-xs font-normal text-muted-foreground">{a.gols === 1 ? "gol" : "gols"}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                {tab === "partidas" &&
                  (partidas.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem partidas encerradas.</p>
                  ) : (
                    <div className="space-y-3">
                      {partidas.map((p) => {
                        const empate = p.placar_a === p.placar_b;
                        const aWin = p.placar_a > p.placar_b;
                        const resultado = empate ? "Empate" : `Vitória ${timeNome(aWin ? p.time_a_id : p.time_b_id)}`;
                        const corVencedor = empate ? undefined : timeCor(aWin ? p.time_a_id : p.time_b_id);
                        const expanded = expandedPartida === p.id;
                        const lancesP = lances.filter((l) => l.partida_id === p.id);
                        return (
                          <div key={p.id} className="rounded-xl border border-white/10 bg-white/5">
                            <button
                              onClick={() => setExpandedPartida(expanded ? null : p.id)}
                              className="flex w-full items-center gap-3 p-3 text-left"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                                <Play className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} fill="currentColor" />
                              </span>
                              <span className="flex-1">
                                <div className="text-sm font-bold text-white">
                                  Partida {p.numero_partida}: {timeNome(p.time_a_id)}{" "}
                                  <span className="font-black">
                                    {p.placar_a} x {p.placar_b}
                                  </span>{" "}
                                  {timeNome(p.time_b_id)}
                                </div>
                                <span
                                  className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${empate ? "bg-white/10 text-muted-foreground" : "bg-black/30"}`}
                                  style={corVencedor ? { color: corVencedor } : undefined}
                                >
                                  {resultado}
                                </span>
                              </span>
                            </button>
                            {expanded && (
                              <div className="space-y-1 border-t border-white/10 p-3 text-xs">
                                {lancesP.length === 0 ? (
                                  <span className="text-muted-foreground">Sem lances.</span>
                                ) : (
                                  lancesP.map((l) => {
                                    const souEu = l.user_id === user?.id;
                                    return (
                                      <div key={l.id} className={`flex justify-between ${souEu ? "font-bold text-white" : "text-white/80"}`}>
                                        <span>
                                          {l.tipo === "gol" ? "⚽" : l.tipo === "passe_decisivo" ? "🎯" : l.tipo === "frango" ? "🧤" : "•"}{" "}
                                          {profiles[l.user_id] || "Jogador"} ({timeNome(l.time_id)})
                                          {souEu && <span className="ml-1.5 text-[10px] font-semibold text-primary">(você)</span>}
                                        </span>
                                        <span className="text-muted-foreground">
                                          {new Date(l.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                {tab === "goleiros" &&
                  (goleiros.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum gol sofrido registrado.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-primary/50 bg-primary/10 p-4 text-center shadow-[0_0_18px_rgba(0,255,135,0.2)]">
                          <div className="mb-2 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            <Shield className="h-3 w-3" /> Menos vazado
                          </div>
                          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/60">
                            <Hand className="h-6 w-6 text-primary" />
                          </div>
                          <div className="text-sm font-bold text-white">{menosVazado?.nome}</div>
                          <div className="mt-1 text-2xl font-extrabold text-primary">{menosVazado?.sofridos}</div>
                          <div className="text-[11px] text-muted-foreground">gols sofridos</div>
                        </div>
                        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-center shadow-[0_0_18px_rgba(255,77,77,0.2)]">
                          <div className="mb-2 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-destructive">
                            <Shield className="h-3 w-3" /> Mais vazado
                          </div>
                          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full border-2 border-destructive/60">
                            <Hand className="h-6 w-6 text-destructive" />
                          </div>
                          <div className="text-sm font-bold text-white">{(maisVazado || menosVazado)?.nome}</div>
                          <div className="mt-1 text-2xl font-extrabold text-destructive">{(maisVazado || menosVazado)?.sofridos}</div>
                          <div className="text-[11px] text-muted-foreground">gols sofridos</div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <BarChart3 className="h-3.5 w-3.5" /> Ranking de goleiros
                        </div>
                        <div className="space-y-1">
                          {goleiros.map((g, i) => {
                            const isWorst = i === goleiros.length - 1 && goleiros.length > 1;
                            const isBest = i === 0;
                            const souEu = g.uid === user?.id;
                            return (
                              <div
                                key={g.uid}
                                className={`flex items-center justify-between rounded-lg py-1.5 px-2 ${souEu ? "bg-white/[0.06]" : ""}`}
                              >
                                <span className="flex items-center gap-3">
                                  <span className={`font-bold ${isBest ? "text-primary" : "text-white/80"}`}>{i + 1}º</span>
                                  <Shield className={`h-4 w-4 ${isWorst ? "text-destructive" : "text-primary"}`} />
                                  <span className={`${souEu ? "font-bold" : "font-medium"} text-white`}>
                                    {g.nome}
                                    {souEu && <span className="ml-1.5 text-[10px] font-semibold text-primary">(você)</span>}
                                  </span>
                                </span>
                                <span className={`text-sm font-bold ${isWorst ? "text-destructive" : isBest ? "text-primary" : "text-white"}`}>
                                  {g.sofridos} <span className="text-xs font-normal text-muted-foreground">gols sofridos</span>
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ))}
              </div>

              {/* Field glow background */}
              <div className="relative mt-4 h-36 overflow-hidden rounded-2xl border border-white/5">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800')" }}
                />
                <div className="absolute inset-0 bg-black/55" />
                <div className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-gradient-to-b from-primary/80 via-primary/15 to-transparent blur-[1px]" />
              </div>

              {/* Footer note */}
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/10">
                  <Trophy className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">{FOOTER_TEXT[tab]}</p>
              </div>
            </>
          )}
        </div>

        {/* Hidden story template used for share-to-story image generation (9:16) */}
        <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
          <div
            ref={storyRef}
            className="flex h-[711px] w-[400px] flex-col justify-between bg-[#0D0D0D] p-8"
            style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(0,255,135,0.5)] bg-[rgba(0,255,135,0.1)]">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <span className="text-xl font-black text-white">
                  MR<span className="text-primary">FUT</span>
                </span>
              </div>
              {peladaInfo && (
                <div className="mt-1 text-xs text-[rgba(255,255,255,0.5)]">
                  {peladaInfo.nome} • {new Date(peladaInfo.data).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>

            <div className="flex-1 py-6">
              {tab === "times" && (
                <>
                  <h3 className="mb-4 text-2xl font-extrabold text-white">🏆 Tabela da Pelada</h3>
                  <div className="space-y-3">
                    {tabela.map((t, i) => (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between rounded-xl px-4 py-3 ${i === 0 ? "border border-[rgba(0,255,135,0.6)] bg-[rgba(0,255,135,0.1)]" : "bg-[rgba(255,255,255,0.05)]"}`}
                      >
                        <span className="flex items-center gap-2 font-bold text-white">
                          {i + 1}º <span className="h-3 w-3 rounded-full" style={{ background: t.cor }} /> {t.nome}
                        </span>
                        <span className={`text-lg font-extrabold ${i === 0 ? "text-primary" : "text-white"}`}>{t.pts} pts</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === "artilheiros" && (
                <>
                  <h3 className="mb-4 text-2xl font-extrabold text-white">⚽ Artilheiros</h3>
                  <div className="space-y-3">
                    {artilheiros.slice(0, 6).map((a, i) => (
                      <div
                        key={a.uid}
                        className={`flex items-center justify-between rounded-xl px-4 py-3 ${i === 0 ? "border border-[rgba(0,255,135,0.6)] bg-[rgba(0,255,135,0.1)]" : "bg-[rgba(255,255,255,0.05)]"}`}
                      >
                        <span className="font-bold text-white">
                          {i + 1}º {a.nome}
                        </span>
                        <span className={`text-lg font-extrabold ${i === 0 ? "text-primary" : "text-white"}`}>{a.gols} gols</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === "partidas" && (
                <>
                  <h3 className="mb-4 text-2xl font-extrabold text-white">📅 Partidas</h3>
                  <div className="space-y-3">
                    {partidas.slice(-6).map((p) => (
                      <div key={p.id} className="rounded-xl bg-[rgba(255,255,255,0.05)] px-4 py-3">
                        <span className="text-sm font-bold text-white">
                          {timeNome(p.time_a_id)} {p.placar_a} x {p.placar_b} {timeNome(p.time_b_id)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === "goleiros" && menosVazado && (
                <>
                  <h3 className="mb-4 text-2xl font-extrabold text-white">🧤 Goleiros</h3>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[rgba(0,255,135,0.6)] bg-[rgba(0,255,135,0.1)] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase text-primary">Menos vazado</div>
                      <div className="text-lg font-bold text-white">{menosVazado.nome}</div>
                      <div className="text-2xl font-extrabold text-primary">{menosVazado.sofridos} gols sofridos</div>
                    </div>
                    {maisVazado && (
                      <div className="rounded-xl border border-[rgba(255,77,77,0.6)] bg-[rgba(255,77,77,0.1)] px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase text-destructive">Mais vazado</div>
                        <div className="text-lg font-bold text-white">{maisVazado.nome}</div>
                        <div className="text-2xl font-extrabold text-destructive">{maisVazado.sofridos} gols sofridos</div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 border-t border-[rgba(255,255,255,0.1)] pt-4">
              <div className="h-1 w-16 rounded-full bg-primary shadow-[0_0_10px_2px_rgba(0,255,135,0.7)]" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
