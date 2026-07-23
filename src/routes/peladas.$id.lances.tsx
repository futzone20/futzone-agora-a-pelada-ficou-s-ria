import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { ArrowLeft, Bell, Clock, MapPin, Shield, X, Activity, Home, CircleDot, Trophy, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { calcularProximaPartida, iniciarProximaPartida, type ProximaPartidaPreview } from "@/lib/rotacaoPartida";


export const Route = createFileRoute("/peladas/$id/lances")({ component: Wrapper });

const STADIUM_BG = "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800";

const TIPOS = [
  { v: "gol", label: "Gol", icon: "⚽", color: "#FFFFFF" },
  { v: "passe_decisivo", label: "Passe", icon: "🤝", color: "#00FF87" },
  { v: "defesa", label: "Defesa", icon: "🧤", color: "#FB923C" },
  { v: "falta", label: "Falta", icon: "🟨", color: "#FACC15" },
  { v: "entrada_forte", label: "Entrada", icon: "⚡", color: "#FACC15" },
  { v: "frango", label: "Frango", icon: "🐔", color: "#FB923C" },
  { v: "cartao_vermelho", label: "C. Vermelho", icon: "🟥", color: "#EF4444" },
  { v: "cartao_amarelo", label: "C. Amarelo", icon: "⚠️", color: "#FACC15" },
  { v: "outro", label: "Reclamação", icon: "😤", color: "#9CA3AF" },
] as const;

const TIPO_LABEL_COR: Record<string, { label: string; color: string }> = {
  gol: { label: "Gol", color: "#FFFFFF" },
  passe_decisivo: { label: "Passe", color: "#00FF87" },
  defesa: { label: "Defesa", color: "#FB923C" },
  falta: { label: "Falta", color: "#FACC15" },
  entrada_forte: { label: "Entrada", color: "#FACC15" },
  frango: { label: "Frango", color: "#FB923C" },
  cartao_vermelho: { label: "Cartão vermelho", color: "#EF4444" },
  cartao_amarelo: { label: "Cartão amarelo", color: "#FACC15" },
  outro: { label: "Reclamação", color: "#9CA3AF" },
};

function Wrapper() {
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <LancesPage />
    </RequireAuth>
  );
}

function LancesPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pelada, setPelada] = useState<any>(null);
  const [quadra, setQuadra] = useState<any>(null);
  const [partida, setPartida] = useState<any>(null);
  const [times, setTimes] = useState<any[]>([]);
  const [timeJogadores, setTimeJogadores] = useState<any[]>([]);
  const [lances, setLances] = useState<any[]>([]);
  const [partidasAll, setPartidasAll] = useState<any[]>([]);
  const [lancesAll, setLancesAll] = useState<any[]>([]);
  const [auxiliar, setAuxiliar] = useState<any>(null);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [drawer, setDrawer] = useState<{ tipo: string; timeId: string } | null>(null);
  const [drawerGoleiro, setDrawerGoleiro] = useState<{ goleiroTimeId: string; goleiroTimeNome: string; goleiroTimeCor: string } | null>(null);
  const [drawerArtilheiro, setDrawerArtilheiro] = useState<{ timeId: string; timeNome: string; timeCor: string } | null>(null);
  const [pendingGol, setPendingGol] = useState<{ userId: string; tipo: string; timeId: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isCapitao, setIsCapitao] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [proximaPreview, setProximaPreview] = useState<ProximaPartidaPreview | null>(null);
  const [confirmandoProxima, setConfirmandoProxima] = useState(false);

  const load = async () => {
    const { data: pelData } = await supabase
      .from("peladas")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setPelada(pelData);

    if (pelData?.quadra_id) {
      const { data: q } = await supabase.from("quadras_publicas").select("nome").eq("id", pelData.quadra_id).maybeSingle();
      setQuadra(q);
    }

    const { data: ps } = await supabase.from("partidas").select("*").eq("pelada_id", id).order("numero_partida");
    const ativa = (ps || []).find((p: any) => p.status === "em_andamento") || (ps || []).find((p: any) => p.status === "aguardando");
    setPartida(ativa);
    setPartidasAll(ps || []);
    const { data: ts } = await supabase.from("times").select("*").eq("pelada_id", id).order("ordem");
    setTimes(ts || []);
    const { data: tj } = await supabase.from("time_jogadores").select("*").eq("pelada_id", id);
    setTimeJogadores(tj || []);
    const { data: lsAll } = await supabase.from("lances").select("*").eq("pelada_id", id).order("criado_em", { ascending: false });
    setLancesAll(lsAll || []);
    if (ativa) {
      const { data: ax } = await supabase.from("auxiliares_partida").select("*").eq("partida_id", ativa.id).maybeSingle();
      setAuxiliar(ax);
      setLances((lsAll || []).filter((l: any) => l.partida_id === ativa.id));
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
    const ch = supabase.channel(`lances-rt-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lances", filter: `pelada_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "lances", filter: `pelada_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "partidas", filter: `pelada_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "partidas", filter: `pelada_id=eq.${id}` }, () => void load())
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

  useEffect(() => {
    if (!ehAuxiliar || !partida || partida.status !== "em_andamento") return;
    if (restanteSec > 0) return;
    void encerrarPartidaAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restanteSec, partida?.id, partida?.status, ehAuxiliar]);

  useEffect(() => {
    if (!pelada || pelada.status !== "em_andamento") { setProximaPreview(null); return; }
    if (partida) { setProximaPreview(null); return; }
    if (proximaPreview) return;
    void calcularProximaPartida(id, pelada).then((p) => { if (p) setProximaPreview(p); });
  }, [pelada?.status, partida, proximaPreview, id]);

  const confirmarProximaPartida = async () => {
    if (!proximaPreview || confirmandoProxima) return;
    setConfirmandoProxima(true);
    try {
      if (proximaPreview.empateSorteio) {
        const nomeTimeSort = times.find((t) => t.id === proximaPreview.timeAId)?.nome || "Time";
        toast.info(`Empate na 1ª partida — sorteio decidiu que o ${nomeTimeSort} fica! 🎲`);
      }
      await iniciarProximaPartida(id, pelada, proximaPreview);
      setProximaPreview(null);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao iniciar a próxima partida");
    } finally {
      setConfirmandoProxima(false);
    }
    void load();
  };

  const corAluguel = tempoAluguelSec > 1200 ? "#00FF87" : tempoAluguelSec > 300 ? "#FACC15" : "#FF4D4D";
  const pulseAluguel = tempoAluguelSec <= 300 ? "animate-pulse" : "";

  const nomeTime = (tid: string) => times.find((t) => t.id === tid)?.nome || "—";
  const corTime = (tid: string) => times.find((t) => t.id === tid)?.cor || "#00FF87";
  const timeA = partida && times.find((t) => t.id === partida.time_a_id);
  const timeB = partida && times.find((t) => t.id === partida.time_b_id);

  const jogadoresDoTime = (tid: string, apenasGoleiro = false) => {
    const todos = timeJogadores.filter((x) => x.time_id === tid);
    if (!apenasGoleiro) return todos;
    const goleiros = todos.filter((x) => x.eh_goleiro);
    return goleiros.length > 0 ? goleiros : todos;
  };

  const dataFmt = useMemo(() => {
    if (!pelada?.data) return "";
    const [y, m, d] = pelada.data.split("-");
    return `${d}/${m}/${y}`;
  }, [pelada]);

  const minutoLance = (l: any, partidaRef?: any) => {
    const ref = partidaRef ?? partida;
    if (!ref?.iniciada_em) return "?'";
    const diff = Math.floor((new Date(l.criado_em).getTime() - new Date(ref.iniciada_em).getTime()) / 60000);
    return `${Math.max(1, diff)}'`;
  };

  const contarReclamacoes = (userId: string, lanceId: string) => {
    const doUsuario = lancesAll
      .filter((l) => l.tipo === "outro" && l.user_id === userId)
      .sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
    const idx = doUsuario.findIndex((l) => l.id === lanceId);
    return idx + 1;
  };

  const textoReclamacao = (nome: string, n: number) => {
    if (n <= 1) return `${nome} reclamou`;
    if (n === 2) return `${nome} reclamou de novo`;
    if (n === 3) return `${nome} já tá reclamando demais hoje`;
    return `${nome} esqueceu de jogar bola e só veio pra reclamar rs`;
  };

  const ordinal = (n: number) => {
    if (n === 1) return "1ª";
    if (n === 2) return "2ª";
    if (n === 3) return "3ª";
    return `${n}ª`;
  };

  const excluirLance = async (lanceId: string) => {
    if (!ehAuxiliar) return;
    const { error } = await supabase.from("lances").delete().eq("id", lanceId);
    if (error) { toast.error(error.message); return; }
    toast.success("Lance removido");
    void load();
  };

  const encerrarPartidaAuto = async () => {
    if (!partida || encerrando) return;
    setEncerrando(true);
    await supabase.from("partidas").update({ status: "encerrada", encerrada_em: new Date().toISOString() } as never).eq("id", partida.id);
    toast.success("Partida encerrada");
    setEncerrando(false);
    void load();
  };

  const marcar = async (userId: string) => {
    if (!partida || !user || !drawer) return;
    const { tipo, timeId } = drawer;

    if (tipo === "gol") {
      const { error } = await supabase.from("lances").insert({
        partida_id: partida.id, pelada_id: id, tipo, user_id: userId, time_id: timeId, marcado_por: user.id,
      } as never);
      if (error) { toast.error(error.message); return; }
      toast.success("Gol registrado! ⚽");
      setDrawer(null);
      void load();

      const { data: partidaAtualizada }: any = await supabase.from("partidas").select("*").eq("id", partida.id).single();
      if (partidaAtualizada) setPartida(partidaAtualizada);

      if (partidaAtualizada) {
        const { data: pel }: any = await supabase.from("peladas").select("gols_para_encerrar").eq("id", id).single();
        if (pel?.gols_para_encerrar && (partidaAtualizada.placar_a >= pel.gols_para_encerrar || partidaAtualizada.placar_b >= pel.gols_para_encerrar)) {
          void encerrarPartidaAuto();
          return;
        }
      }

      const timeAdversarioId = timeId === partida.time_a_id ? partida.time_b_id : partida.time_a_id;
      const timeAdversario = times.find((t: any) => t.id === timeAdversarioId);
      const jogadoresAdversario = timeJogadores.filter((j: any) => j.time_id === timeAdversarioId);

      if (jogadoresAdversario.length > 0 && timeAdversario) {
        setPendingGol({ userId, tipo, timeId });
        setDrawerGoleiro({
          goleiroTimeId: timeAdversarioId,
          goleiroTimeNome: timeAdversario.nome,
          goleiroTimeCor: timeAdversario.cor,
        });
      }
      return;
    }

    if (tipo === "frango") {
      const { error } = await supabase.from("lances").insert({
        partida_id: partida.id, pelada_id: id, tipo: "frango", user_id: userId, time_id: timeId, marcado_por: user.id,
      } as never);
      if (error) { toast.error(error.message); return; }
      toast.success("Frango registrado 🐔");
      setDrawer(null);
      void load();

      const timeAdversarioId = timeId === partida.time_a_id ? partida.time_b_id : partida.time_a_id;
      const timeAdversario = times.find((t: any) => t.id === timeAdversarioId);
      const jogadoresAdversario = timeJogadores.filter((j: any) => j.time_id === timeAdversarioId);

      if (jogadoresAdversario.length > 0 && timeAdversario) {
        setDrawerArtilheiro({
          timeId: timeAdversarioId,
          timeNome: timeAdversario.nome,
          timeCor: timeAdversario.cor,
        });
      }
      return;
    }

    const { error } = await supabase.from("lances").insert({
      partida_id: partida.id, pelada_id: id, tipo, user_id: userId, time_id: timeId, marcado_por: user.id,
    } as never);
    if (error) toast.error(error.message);
    else toast.success("Lance marcado ✓");
    setDrawer(null);
    void load();

    const { data: partidaAtualizada }: any = await supabase.from("partidas").select("*").eq("id", partida.id).single();
    if (partidaAtualizada) setPartida(partidaAtualizada);
  };

  const marcarGoleiro = async (goleiroUserId: string | null) => {
    if (!partida || !user || !drawerGoleiro) return;
    if (goleiroUserId) {
      await supabase.from("lances").insert({
        partida_id: partida.id,
        pelada_id: id,
        tipo: "frango",
        user_id: goleiroUserId,
        time_id: drawerGoleiro.goleiroTimeId,
        marcado_por: user.id,
      } as never);
      toast.success("Goleiro registrado 🧤");
    }
    setDrawerGoleiro(null);
    setPendingGol(null);
    void load();
  };

  const marcarArtilheiro = async (userId: string | null) => {
    if (!partida || !user || !drawerArtilheiro) return;
    if (userId) {
      const { error } = await supabase.from("lances").insert({
        partida_id: partida.id, pelada_id: id, tipo: "gol", user_id: userId, time_id: drawerArtilheiro.timeId, marcado_por: user.id,
      } as never);
      if (error) { toast.error(error.message); setDrawerArtilheiro(null); return; }
      toast.success("Gol registrado! ⚽");

      const { data: partidaAtualizada }: any = await supabase.from("partidas").select("*").eq("id", partida.id).single();
      if (partidaAtualizada) setPartida(partidaAtualizada);

      const { data: pel }: any = await supabase.from("peladas").select("gols_para_encerrar").eq("id", id).single();
      if (pel?.gols_para_encerrar && partidaAtualizada && (partidaAtualizada.placar_a >= pel.gols_para_encerrar || partidaAtualizada.placar_b >= pel.gols_para_encerrar)) {
        setDrawerArtilheiro(null);
        void encerrarPartidaAuto();
        return;
      }
    }
    setDrawerArtilheiro(null);
    void load();
  };

  if (!partida) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] p-4 space-y-3" style={{ maxWidth: 480, margin: "0 auto" }}>
        <Link to="/peladas/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
        {proximaPreview ? (
          <div className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-6 text-center space-y-4">
            <div className="text-5xl">🏁</div>
            <div className="text-xl font-black text-white">Partida encerrada!</div>
            <div className="text-sm text-white/70">
              Próxima partida:{" "}
              <span className="font-bold text-white">{times.find((t) => t.id === proximaPreview.timeAId)?.nome || "Time"}</span>
              {" "}x{" "}
              <span className="font-bold text-white">{times.find((t) => t.id === proximaPreview.timeBId)?.nome || "Time"}</span>
            </div>
            {ehAuxiliar ? (
              <button
                onClick={confirmarProximaPartida}
                disabled={confirmandoProxima}
                className="w-full rounded-xl px-4 py-3 text-base font-black uppercase tracking-wider text-black disabled:opacity-50"
                style={{ background: "#00FF87" }}
              >
                {confirmandoProxima ? "Iniciando..." : "▶ Iniciar Partida"}
              </button>
            ) : (
              <p className="text-xs text-white/60">Aguardando o capitão iniciar a próxima partida...</p>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Nenhuma partida em andamento.</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh", background: "#0D0D0D", display: "flex", flexDirection: "column" }}>
      <style>{`body { overflow-x: hidden; } ::-webkit-scrollbar { display: none; } * { scrollbar-width: none; }`}</style>
      {/* BLOCO 1 — HERO */}
      <div
        className="relative shrink-0"
        style={{
          paddingBottom: 16,
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.5) 100%), url(${STADIUM_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          padding: 16,
        }}
      >
        {/* Linha topo */}
        <div className="flex items-center justify-between">
          <Link to="/peladas/$id" params={{ id }} className="text-white">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div className="text-xl font-black italic tracking-tight">
            <span className="text-white">MR</span><span style={{ color: "#00FF87" }}>FUT</span>
          </div>
          <div className="relative">
            <Bell className="h-6 w-6 text-white" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full" style={{ background: "#00FF87" }} />
          </div>
        </div>

        {/* Linha 2 — Badge + Info */}
        <div className="mt-3 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: "rgba(0,255,135,0.15)" }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#00FF87" }} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#00FF87" }}>Pelada ao vivo</span>
            </div>
            <div className="mt-1 text-xs text-white/70">Partida {partida.numero_partida}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-right text-[11px] text-white/80 space-y-0.5">
            <div className="flex items-center justify-end gap-1"><Clock className="h-3 w-3" /> {dataFmt} • {pelada?.horario_inicio?.slice(0,5)}</div>
            {quadra?.nome && <div className="flex items-center justify-end gap-1"><MapPin className="h-3 w-3" /> {quadra.nome}</div>}
            <div className={`flex items-center justify-end gap-1 font-bold tabular-nums ${pulseAluguel}`} style={{ color: corAluguel }}>
              <span className="text-white/60 font-normal">Pelada:</span> {fmt(tempoAluguelSec)}
            </div>
          </div>
        </div>

        {/* Linha 3 — Placar principal */}
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* Time A */}
          <div className="flex flex-col items-center">
            <div
              className="grid h-16 w-14 place-items-center rounded-t-xl rounded-b-[24px_16px]"
              style={{ background: `${timeA?.cor}22`, border: `2px solid ${timeA?.cor}` }}
            >
              <Shield className="h-8 w-8" style={{ color: timeA?.cor }} />
            </div>
            <div className="mt-1.5 text-sm font-bold truncate max-w-full" style={{ color: timeA?.cor }}>{timeA?.nome}</div>
          </div>

          {/* Centro cronômetro + placar */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/60">⏱ Partida</div>
            <div className="text-[56px] font-black leading-none tabular-nums" style={{ color: "#00FF87" }}>
              {fmt(restanteSec)}
            </div>
            <div className="mt-2 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/40 px-5 py-2">
              <span className="text-[44px] font-black leading-none tabular-nums" style={{ color: timeA?.cor }}>{partida.placar_a}</span>
              <span className="text-2xl font-bold text-white/40">x</span>
              <span className="text-[44px] font-black leading-none tabular-nums text-white">{partida.placar_b}</span>
            </div>
          </div>

          {/* Time B */}
          <div className="flex flex-col items-center">
            <div
              className="grid h-16 w-14 place-items-center rounded-t-xl rounded-b-[24px_16px]"
              style={{ background: `${timeB?.cor}22`, border: `2px solid ${timeB?.cor}` }}
            >
              <Shield className="h-8 w-8" style={{ color: timeB?.cor }} />
            </div>
            <div className="mt-1.5 text-sm font-bold truncate max-w-full" style={{ color: timeB?.cor }}>{timeB?.nome}</div>
          </div>
        </div>
      </div>

      {/* BLOCO 2 — GRID DE LANCES */}
      <div className="relative p-3">
        <div className="grid grid-cols-2 gap-3 relative">
          {/* VS separator */}
          <div className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="flex-1 w-px bg-[#2A2A2A]" />
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[10px] font-bold text-white">VS</div>
            <div className="flex-1 w-px bg-[#2A2A2A]" />
          </div>

          {[timeA, timeB].map((t: any) => t && (
            <div key={t.id} className="rounded-2xl border border-[#1F1F1F] bg-[#111111] p-2.5">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: t.cor }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: t.cor }}>{t.nome}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {TIPOS.map((tp) => (
                  <button
                    key={tp.v}
                    onClick={() => ehAuxiliar && setDrawer({ tipo: tp.v, timeId: t.id })}
                    disabled={!ehAuxiliar}
                    className="flex h-[72px] flex-col items-center justify-center gap-1 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] transition active:scale-95 active:bg-[#252525] disabled:opacity-50"
                  >
                    <span className="text-2xl leading-none" style={{ color: tp.color }}>{tp.icon}</span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/70">{tp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BLOCO 3 — LANCES RECENTES (agrupados por partida) */}
      <div className="border-t border-[#1F1F1F] bg-[#0D0D0D] px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" style={{ color: "#00FF87" }} />
            <span className="text-xs font-bold uppercase tracking-wider text-white">Lances Recentes</span>
          </div>
        </div>
        {lancesAll.length === 0 ? (
          <p className="text-xs text-white/50">Nenhum lance marcado.</p>
        ) : (
          <div className="space-y-3">
            {[...partidasAll]
              .filter((p) => lancesAll.some((l) => l.partida_id === p.id))
              .sort((a, b) => b.numero_partida - a.numero_partida)
              .map((p) => {
                const lancesP = lancesAll
                  .filter((l) => l.partida_id === p.id)
                  .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
                const tA = times.find((t) => t.id === p.time_a_id);
                const tB = times.find((t) => t.id === p.time_b_id);
                const emAndamento = p.status === "em_andamento";
                const statusLabel = p.status === "encerrada" ? "ENCERRADA" : p.status === "aguardando" ? "AGUARDANDO" : "AO VIVO";
                return (
                  <div key={p.id} className="rounded-xl overflow-hidden border border-[#1F1F1F]">
                    <div className="flex items-center justify-between gap-2 bg-[#111111] px-3 py-2 rounded-t-xl">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 shrink-0">{ordinal(p.numero_partida)} PARTIDA</span>
                        <span className="text-[12px] font-bold text-white truncate">
                          <span style={{ color: tA?.cor }}>{tA?.nome || "—"}</span>
                          <span className="mx-1 text-white/80">{p.placar_a} x {p.placar_b}</span>
                          <span style={{ color: tB?.cor }}>{tB?.nome || "—"}</span>
                        </span>
                      </div>
                      {emAndamento ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider animate-pulse" style={{ background: "rgba(255,77,77,0.15)", color: "#FF4D4D" }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#FF4D4D" }} />AO VIVO
                        </span>
                      ) : (
                        <span className="rounded-full border border-[#2A2A2A] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/50">{statusLabel}</span>
                      )}
                    </div>
                    <div className="bg-[#1A1A1A]">
                      {lancesP.map((l, idx) => {
                        const info = TIPO_LABEL_COR[l.tipo] || { label: l.tipo, color: "#9CA3AF" };
                        const icon = TIPOS.find((t) => t.v === l.tipo)?.icon || "•";
                        const nome = profiles[l.user_id]?.nome || "Jogador";
                        return (
                          <div key={l.id} className={`flex items-center gap-2 px-3 py-2 ${idx > 0 ? "border-t border-[#2A2A2A]" : ""}`}>
                            <div className="grid h-7 w-7 place-items-center rounded-full shrink-0" style={{ background: `${info.color}22` }}>
                              <span className="text-sm">{icon}</span>
                            </div>
                            <div className="flex-1 min-w-0 text-[12px] leading-tight">
                              {l.tipo === "outro" ? (
                                <span className="font-semibold text-white/90">{textoReclamacao(nome, contarReclamacoes(l.user_id, l.id))}</span>
                              ) : (
                                <>
                                  <span className="font-bold text-white">{nome}</span>
                                  <span className="text-white/70"> {l.tipo === "frango" ? "levou um" : "fez"} </span>
                                  <span className="font-semibold" style={{ color: info.color }}>{info.label}</span>
                                  <span className="text-white/50"> — </span>
                                  <span className="font-medium" style={{ color: corTime(l.time_id) }}>{nomeTime(l.time_id)}</span>
                                </>
                              )}
                            </div>
                            <span className="rounded-full bg-[#0D0D0D] px-1.5 py-0.5 text-[10px] font-bold text-white/60 tabular-nums shrink-0">{minutoLance(l, p)}</span>
                            {ehAuxiliar && (
                              <button onClick={() => excluirLance(l.id)} className="text-white/40 hover:text-red-400 shrink-0" aria-label="Excluir lance">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* BLOCO 4 — ENCERRAR */}
      {ehAuxiliar && (
        <div className="px-3 py-2">
          <button
            onClick={() => encerrarPartidaAuto()}
            disabled={encerrando}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold uppercase tracking-wider text-white shadow-lg disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #CC0000, #FF4444)" }}
          >
            <div className="relative">
              <Shield className="h-5 w-5" />
              <X className="absolute inset-0 m-auto h-3 w-3" />
            </div>
            Encerrar Partida
          </button>
        </div>
      )}

      {/* NAV INFERIOR */}
      <nav className="sticky bottom-0 border-t border-[#2A2A2A] bg-[#0D0D0D]" style={{ height: 64 }}>
        <div className="grid h-full grid-cols-4">
          <button onClick={() => navigate({ to: "/jogador" })} className="flex flex-col items-center justify-center gap-0.5 text-white/60">
            <Home className="h-5 w-5" />
            <span className="text-[10px]">Início</span>
          </button>
          <button className="flex flex-col items-center justify-center gap-0.5" style={{ color: "#00FF87" }}>
            <CircleDot className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Peladas</span>
            <span className="h-1 w-1 rounded-full" style={{ background: "#00FF87" }} />
          </button>
          <button onClick={() => navigate({ to: "/jogador/ranking" })} className="flex flex-col items-center justify-center gap-0.5 text-white/60">
            <Trophy className="h-5 w-5" />
            <span className="text-[10px]">Ranking</span>
          </button>
          <button onClick={() => navigate({ to: "/jogador/perfil" })} className="flex flex-col items-center justify-center gap-0.5 text-white/60">
            <User className="h-5 w-5" />
            <span className="text-[10px]">Perfil</span>
          </button>
        </div>
      </nav>

      {/* Drawer jogador */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setDrawer(null)}>
          <div
            className="w-full rounded-t-2xl bg-[#1A1A1A] p-4 shadow-xl"
            style={{ maxWidth: 480, margin: "0 auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {drawer.tipo === "frango" ? "Qual goleiro levou o frango? 🐔" : `Quem fez o ${TIPOS.find((t) => t.v === drawer.tipo)?.label}?`}
              </h3>
              <button onClick={() => setDrawer(null)} className="text-white/60"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto">
              {jogadoresDoTime(drawer.timeId, drawer.tipo === "frango").map((j) => (
                <button
                  key={j.user_id}
                  onClick={() => marcar(j.user_id)}
                  className="flex h-[52px] items-center gap-2 rounded-lg bg-[#2A2A2A] px-3 text-left font-bold text-white transition active:scale-95"
                >
                  <span className="truncate text-sm">{profiles[j.user_id]?.nome || "Jogador"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Drawer goleiro */}
      {drawerGoleiro && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => { setDrawerGoleiro(null); setPendingGol(null); }}>
          <div
            className="w-full rounded-t-2xl bg-[#1A1A1A] p-4 shadow-xl"
            style={{ maxWidth: 480, margin: "0 auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Quem tomou o gol? 🧤</h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Goleiro do <span className="font-bold" style={{ color: drawerGoleiro.goleiroTimeCor }}>{drawerGoleiro.goleiroTimeNome}</span>
                </p>
              </div>
              <button onClick={() => { setDrawerGoleiro(null); setPendingGol(null); void load(); }} className="text-white/60">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
              {jogadoresDoTime(drawerGoleiro.goleiroTimeId, true)
                .map((j: any) => (
                  <button
                    key={j.user_id}
                    onClick={() => marcarGoleiro(j.user_id)}
                    className="flex h-[52px] items-center gap-2 rounded-lg bg-[#2A2A2A] px-3 text-left font-bold text-white transition active:scale-95"
                  >
                    <span className="truncate text-sm">{profiles[j.user_id]?.nome || "Jogador"}</span>
                  </button>
                ))
              }
            </div>
            <button
              onClick={() => marcarGoleiro(null)}
              className="mt-3 w-full rounded-lg border border-[#2A2A2A] py-2 text-sm text-white/60"
            >
              Pular — sem goleiro definido
            </button>
          </div>
        </div>
      )}

      {/* Drawer artilheiro (quem fez o gol, depois de marcar um frango) */}
      {drawerArtilheiro && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => marcarArtilheiro(null)}>
          <div
            className="w-full rounded-t-2xl bg-[#1A1A1A] p-4 shadow-xl"
            style={{ maxWidth: 480, margin: "0 auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Quem fez o gol? ⚽</h3>
                <p className="text-xs text-white/60 mt-0.5">
                  Jogador do <span className="font-bold" style={{ color: drawerArtilheiro.timeCor }}>{drawerArtilheiro.timeNome}</span>
                </p>
              </div>
              <button onClick={() => marcarArtilheiro(null)} className="text-white/60">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
              {jogadoresDoTime(drawerArtilheiro.timeId).map((j: any) => (
                <button
                  key={j.user_id}
                  onClick={() => marcarArtilheiro(j.user_id)}
                  className="flex h-[52px] items-center gap-2 rounded-lg bg-[#2A2A2A] px-3 text-left font-bold text-white transition active:scale-95"
                >
                  <span className="truncate text-sm">{profiles[j.user_id]?.nome || "Jogador"}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => marcarArtilheiro(null)}
              className="mt-3 w-full rounded-lg border border-[#2A2A2A] py-2 text-sm text-white/60"
            >
              Pular — sem artilheiro definido
            </button>
          </div>
        </div>
      )}

      {pendingGol && <span className="hidden" />}
    </div>
  );
}
