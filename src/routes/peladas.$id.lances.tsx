import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { ArrowLeft, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { sugerirTrocaGoleiro } from "@/lib/sorteio";

export const Route = createFileRoute("/peladas/$id/lances")({ component: Wrapper });

const TIPOS = [
  { v: "gol", label: "Gol", icon: "⚽" },
  { v: "passe_decisivo", label: "Passe", icon: "🤝" },
  { v: "defesa", label: "Defesa", icon: "🧤" },
  { v: "falta", label: "Falta", icon: "🟨" },
  { v: "entrada_forte", label: "Entrada", icon: "🦵" },
  { v: "frango", label: "Frango", icon: "🐔" },
  { v: "cartao_vermelho", label: "C. Vermelho", icon: "🟥" },
  { v: "cartao_amarelo", label: "C. Amarelo", icon: "⚠️" },
  { v: "outro", label: "Outro", icon: "•" },
] as const;

function Wrapper() {
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <LancesPage />
    </RequireAuth>
  );
}

function LancesPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [pelada, setPelada] = useState<any>(null);
  const [partida, setPartida] = useState<any>(null);
  const [times, setTimes] = useState<any[]>([]);
  const [timeJogadores, setTimeJogadores] = useState<any[]>([]);
  const [lances, setLances] = useState<any[]>([]);
  const [auxiliar, setAuxiliar] = useState<any>(null);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [drawer, setDrawer] = useState<{ tipo: string; timeId: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isCapitao, setIsCapitao] = useState(false);
  const [encerrando, setEncerrando] = useState(false);

  const load = async () => {
    const { data: pelData } = await supabase
      .from("peladas")
      .select("aluguel_iniciado_em, tempo_locado_minutos, grupo_id, gols_para_encerrar, modalidade_goleiro")
      .eq("id", id)
      .maybeSingle();
    setPelada(pelData);

    const { data: ps } = await supabase.from("partidas").select("*").eq("pelada_id", id).order("numero_partida");
    const ativa = (ps || []).find((p: any) => p.status === "em_andamento") || (ps || []).find((p: any) => p.status === "aguardando");
    setPartida(ativa);
    const { data: ts } = await supabase.from("times").select("*").eq("pelada_id", id).order("ordem");
    setTimes(ts || []);
    const { data: tj } = await supabase.from("time_jogadores").select("*").eq("pelada_id", id);
    setTimeJogadores(tj || []);
    if (ativa) {
      const { data: ax } = await supabase.from("auxiliares_partida").select("*").eq("partida_id", ativa.id).maybeSingle();
      setAuxiliar(ax);
      const { data: ls } = await supabase.from("lances").select("*").eq("partida_id", ativa.id).order("criado_em", { ascending: false });
      setLances(ls || []);
    }
    if (pelData && user) {
      const { data: membro } = await supabase.from("grupo_membros")
        .select("papel")
        .eq("grupo_id", pelData.grupo_id)
        .eq("user_id", user.id)
        .eq("status", "ativo")
        .maybeSingle();
      setIsCapitao(membro?.papel === "capitao");
    }
    const uids = (tj || []).map((x: any) => x.user_id);
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", uids);
      const m: Record<string, any> = {};
      (profs || []).forEach((x: any) => { m[x.user_id] = x; });
      setProfiles(m);
    }
  };

  useEffect(() => { void load(); }, [id]);

  useEffect(() => {
    const ch = supabase.channel(`lances-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lances", filter: `pelada_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "partidas", filter: `pelada_id=eq.${id}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  const tempoAluguelSec = useMemo(() => {
    if (!pelada?.aluguel_iniciado_em) return (pelada?.tempo_locado_minutos || 60) * 60;
    const fim = new Date(pelada.aluguel_iniciado_em).getTime() + (pelada.tempo_locado_minutos || 60) * 60_000;
    return Math.max(0, Math.floor((fim - now) / 1000));
  }, [pelada, now]);

  const ehAuxiliar = isCapitao || (auxiliar && auxiliar.user_id === user?.id);
  const restanteSec = useMemo(() => {
    if (!partida?.iniciada_em || partida.status !== "em_andamento") return partida ? partida.duracao_minutos * 60 : 0;
    const ini = new Date(partida.iniciada_em).getTime();
    return Math.max(0, partida.duracao_minutos * 60 - Math.floor((now - ini) / 1000));
  }, [partida, now]);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const nomeTime = (tid: string) => times.find((t) => t.id === tid)?.nome || "—";
  const corTime = (tid: string) => times.find((t) => t.id === tid)?.cor || "#00FF87";
  const timeA = partida && times.find((t) => t.id === partida.time_a_id);
  const timeB = partida && times.find((t) => t.id === partida.time_b_id);

  const jogadoresDoTime = (tid: string) => timeJogadores.filter((x) => x.time_id === tid);

  const corCronoAluguel = tempoAluguelSec > 1200 ? "#00FF87" : tempoAluguelSec > 300 ? "#FFD700" : "#FF4D4D";
  const pulseAluguel = tempoAluguelSec <= 300 ? "animate-pulse" : "";

  const encerrarPartidaAuto = async () => {
    if (!partida || encerrando) return;
    setEncerrando(true);
    const { data: p }: any = await supabase.from("partidas").select("*").eq("id", partida.id).single();
    const vencedor = p.placar_a > p.placar_b ? p.time_a_id : p.placar_b > p.placar_a ? p.time_b_id : null;
    const { data: pel }: any = await supabase.from("peladas").select("*").eq("id", id).single();

    if (pel?.modalidade_goleiro === "fixo" && vencedor && p.time_fora_id) {
      const { data: tmsData } = await supabase.from("times").select("*").eq("pelada_id", id);
      const { data: tjData } = await supabase.from("time_jogadores").select("*").eq("pelada_id", id);
      const userIds = (tjData || []).map((x: any) => x.user_id);
      const safe = userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"];
      const { data: sksData } = await supabase.from("skills")
        .select("user_id, velocidade, drible, passe, chute, resistencia, posicionamento").in("user_id", safe);
      const { data: profsData } = await supabase.from("profiles").select("user_id, nome").in("user_id", safe);
      const timesComNivel = (tmsData || []).map((t: any) => {
        const jogs = (tjData || []).filter((j: any) => j.time_id === t.id && !j.eh_goleiro);
        const gk = (tjData || []).find((j: any) => j.time_id === t.id && j.eh_goleiro);
        const nivelGeral = jogs.length > 0
          ? jogs.reduce((acc: number, j: any) => {
              const sk: any = (sksData || []).find((s: any) => s.user_id === j.user_id);
              const m = sk ? (sk.velocidade + sk.drible + sk.passe + sk.chute + sk.resistencia + sk.posicionamento) / 6 : 3;
              return acc + m;
            }, 0) / jogs.length
          : 3;
        const gkProf: any = gk ? (profsData || []).find((x: any) => x.user_id === gk.user_id) : null;
        const gkSk: any = gk ? (sksData || []).find((x: any) => x.user_id === gk.user_id) : null;
        return {
          id: t.id, nome: t.nome, cor: t.cor, nivelGeral,
          goleiro: gk ? { user_id: gk.user_id, nome: gkProf?.nome || "Goleiro", nivel: gkSk ? (gkSk.velocidade + gkSk.drible + gkSk.passe + gkSk.chute + gkSk.resistencia + gkSk.posicionamento) / 6 : 3 } : null,
        };
      });
      const proximoPerdedor = vencedor === p.time_a_id ? p.time_b_id : p.time_a_id;
      const { sugestao: temSug, trocas } = sugerirTrocaGoleiro({
        times: timesComNivel,
        timeVencedorId: vencedor,
        timePerdedorId: proximoPerdedor,
        timeForaId: p.time_fora_id,
      });
      if (temSug && trocas.length > 0) {
        for (const tr of trocas) {
          await supabase.from("time_jogadores").update({ time_id: tr.paraTimeId } as never).eq("pelada_id", id).eq("user_id", tr.goleiroId);
        }
      }
    }

    await supabase.from("partidas").update({ status: "encerrada", encerrada_em: new Date().toISOString() } as never).eq("id", partida.id);
    toast.success("Partida encerrada");
    setEncerrando(false);
    void load();
  };

  const marcar = async (userId: string) => {
    if (!partida || !user || !drawer) return;
    const { tipo, timeId } = drawer;
    const { error } = await supabase.from("lances").insert({
      partida_id: partida.id, pelada_id: id, tipo, user_id: userId, time_id: timeId, marcado_por: user.id,
    } as never);
    if (error) toast.error(error.message);
    else toast.success("Lance marcado ✓");
    setDrawer(null);

    // Refetch partida para refletir placar atualizado pelo trigger
    const { data: partidaAtualizada }: any = await supabase
      .from("partidas")
      .select("*")
      .eq("id", partida.id)
      .single();
    if (partidaAtualizada) setPartida(partidaAtualizada);

    if (tipo === "gol" && partidaAtualizada) {
      const { data: pel }: any = await supabase.from("peladas").select("gols_para_encerrar").eq("id", id).single();
      if (pel?.gols_para_encerrar && (partidaAtualizada.placar_a >= pel.gols_para_encerrar || partidaAtualizada.placar_b >= pel.gols_para_encerrar)) {
        void encerrarPartidaAuto();
      }
    }
  };

  const excluir = async (lid: string) => {
    if (!confirm("Excluir este lance?")) return;
    const { error } = await supabase.from("lances").delete().eq("id", lid);
    if (error) toast.error(error.message);
  };

  if (!partida) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] p-4 space-y-3">
        <Link to="/peladas/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Nenhuma partida em andamento.</div>
      </div>
    );
  }

  const renderGridLances = (timeId: string) => (
    <div className="grid grid-cols-3 gap-1.5 p-2">
      {TIPOS.map((t) => (
        <button
          key={t.v}
          onClick={() => ehAuxiliar && setDrawer({ tipo: t.v, timeId })}
          disabled={!ehAuxiliar}
          className="flex h-14 flex-col items-center justify-center rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] transition active:scale-95 disabled:opacity-50"
        >
          <span className="text-xl leading-none">{t.icon}</span>
          <span className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{t.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#0D0D0D]">
      {/* BLOCO 1 — Cronômetros */}
      <div className="border-b border-[#2A2A2A] bg-[#1A1A1A] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">⏱ Pelada</span>
          <span className={`text-[28px] font-black tabular-nums ${pulseAluguel}`} style={{ color: corCronoAluguel }}>
            {fmt(tempoAluguelSec)}
          </span>
          <span className="w-16" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">⚽ Partida {partida.numero_partida}</span>
          <span className={`text-[22px] font-black tabular-nums ${restanteSec <= 30 ? "text-red-500 animate-pulse" : "text-foreground"}`}>
            {fmt(restanteSec)}
          </span>
          <span className="text-lg font-black text-primary tabular-nums w-16 text-right">{partida.placar_a} x {partida.placar_b}</span>
        </div>
      </div>

      {/* BLOCO 2 — Tabela de Lances (2 colunas) */}
      <div className="flex flex-1 divide-x divide-[#2A2A2A]">
        {[timeA, timeB].map((t: any, i) => t && (
          <div key={t.id} className="flex flex-1 flex-col">
            <div className="flex items-center justify-center gap-2 border-b border-[#2A2A2A] py-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: t.cor }} />
              <span className="text-sm font-bold" style={{ color: t.cor }}>{t.nome}</span>
            </div>
            {renderGridLances(t.id)}
          </div>
        ))}
      </div>

      {ehAuxiliar && (
        <div className="border-t border-[#2A2A2A] p-2">
          <Button onClick={() => encerrarPartidaAuto()} disabled={encerrando} className="h-11 w-full bg-red-600 font-bold hover:bg-red-700">
            Encerrar Partida
          </Button>
        </div>
      )}

      {/* BLOCO 4 — Histórico */}
      <div className="border-t border-[#2A2A2A] bg-[#1A1A1A] p-2" style={{ height: 120 }}>
        <div className="mb-1 flex items-center justify-between">
          <Link to="/peladas/$id" params={{ id }} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowLeft className="h-3 w-3" />Voltar
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lances ({lances.length})</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ maxHeight: 84 }}>
          {lances.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum lance marcado.</p>
          ) : lances.map((l) => {
            const tipo = TIPOS.find((t) => t.v === l.tipo);
            return (
              <div key={l.id} className="flex shrink-0 items-center gap-1.5 rounded bg-[#2A2A2A] px-2 py-1.5 text-xs">
                <span className="text-base">{tipo?.icon}</span>
                <div className="flex flex-col leading-tight">
                  <span className="font-bold">{profiles[l.user_id]?.nome || "—"}</span>
                  <span className="text-[10px]" style={{ color: corTime(l.time_id) }}>{nomeTime(l.time_id)}</span>
                </div>
                {ehAuxiliar && (
                  <button onClick={() => excluir(l.id)} className="ml-1 text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BLOCO 3 — Drawer seletor de jogador */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setDrawer(null)}>
          <div
            className="w-full rounded-t-2xl bg-[#1A1A1A] p-4 shadow-xl transition-transform duration-300"
            style={{ transform: "translateY(0)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Quem fez o {TIPOS.find((t) => t.v === drawer.tipo)?.label}?
              </h3>
              <button onClick={() => setDrawer(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
              {jogadoresDoTime(drawer.timeId).map((j) => (
                <button
                  key={j.user_id}
                  onClick={() => marcar(j.user_id)}
                  className="flex h-[52px] items-center gap-2 rounded-lg bg-[#2A2A2A] px-3 text-left font-bold transition active:scale-95"
                >
                  {j.eh_goleiro && <span>🧤</span>}
                  <span className="truncate text-sm">{profiles[j.user_id]?.nome || "Jogador"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
