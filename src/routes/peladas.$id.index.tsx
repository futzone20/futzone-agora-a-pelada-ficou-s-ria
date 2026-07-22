import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { GerenciarPresencasModal } from "@/components/GerenciarPresencasModal";
import { CircleDot, ArrowLeft, Calendar, Clock, MapPin, Trophy, Home, User, Shuffle, Users, RefreshCw, Bell, Shield, Info, Check, X, Star, BarChart3, Dice5, Play, ClipboardList, Shirt, Hand, ChevronRight, Crown } from "lucide-react";
import { calcularTabela } from "@/lib/placar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { mediaSkill, mediaTime, corTextoLegivel, type Jogador } from "@/lib/sorteio";
import { proximaRodada, escolherTimesIniciais } from "@/lib/rodizio";
import { useConfirm } from "@/components/ConfirmProvider";
import { StatusBadge, ConfirmadosProgress } from "@/lib/pelada-status";
import { StatsPeladaModal } from "@/components/StatsPeladaModal";
import { notificarVencedoresPelada } from "@/lib/notificarVencedores";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/peladas/$id/")({
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
      <MobileShell items={items as any}><PeladaDetail /></MobileShell>
    </RequireAuth>
  );
}

function PeladaDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [pelada, setPelada] = useState<any>(null);
  const [quadra, setQuadra] = useState<any>(null);
  const [confirmacoes, setConfirmacoes] = useState<any[]>([]);
  const [convidados, setConvidados] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, { nome: string }>>({});
  const [skillsMap, setSkillsMap] = useState<Record<string, any>>({});
  const [times, setTimes] = useState<{ id: string; nome: string; cor: string; ordem: number; membros: Jogador[] }[]>([]);
  const [isCapitao, setIsCapitao] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [presencasOpen, setPresencasOpen] = useState(false);
  const [sorteioOpen, setSorteioOpen] = useState(false);
  const [partidaAtual, setPartidaAtual] = useState<any>(null);
  const [tempoRestante, setTempoRestante] = useState<number>(0);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsInitialTab, setStatsInitialTab] = useState<"times" | "artilheiros" | "partidas" | "goleiros">("times");
  const [resumoEncerrada, setResumoEncerrada] = useState<{
    vencedor: { id: string; nome: string; cor: string } | null;
    mvpNome: string | null;
    artilheiroNome: string | null;
    artilheiroGols: number;
  } | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [tempoAluguelSec, setTempoAluguelSec] = useState<number>(0);
  const [tempoPausadoAtual, setTempoPausadoAtual] = useState(0);
  const [proximaPreview, setProximaPreview] = useState<{
    timeAId: string; timeBId: string; timeForaId: string | null; novaFila: string[];
    saidas: { entrouEm: "A" | "B"; timeQueSaiu: string }[]; numeroPartida: number; empateSorteio: boolean;
  } | null>(null);
  const [avisoAluguelOpen, setAvisoAluguelOpen] = useState(false);
  const [graceSec, setGraceSec] = useState(180);

  const minutosAtraso = useMemo(() => {
    if (!pelada?.data || !pelada?.horario_inicio) return 0;
    try {
      const horarioPrevisto = new Date(`${pelada.data}T${pelada.horario_inicio}`);
      return Math.max(0, Math.floor((Date.now() - horarioPrevisto.getTime()) / 1000 / 60));
    } catch {
      return 0;
    }
  }, [pelada]);
  const estaAtrasado = minutosAtraso > 5;

  const load = async () => {
    setLoading(true);
    try {
      const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
      setPelada(p);
      if (p?.quadra_id) {
        const { data: q } = await supabase.from("quadras_publicas").select("*").eq("id", p.quadra_id).maybeSingle();
        setQuadra(q);
      }
      if (p && user) {
        const { data: m } = await supabase.from("grupo_membros").select("papel").eq("grupo_id", p.grupo_id).eq("user_id", user.id).eq("status", "ativo").maybeSingle();
        setIsCapitao(!!m && (m.papel === "capitao" || m.papel === "auxiliar"));
      }
      const { data: cc } = await supabase.from("pelada_confirmacoes").select("*").eq("pelada_id", id).order("confirmado_em");
      setConfirmacoes(cc || []);
      const { data: conv } = await supabase.from("pelada_convidados").select("*").eq("pelada_id", id);
      setConvidados(conv || []);
      const confUserIds = (cc || []).map((r: any) => r.user_id);
      const safeConfIds = confUserIds.length > 0 ? confUserIds : ["00000000-0000-0000-0000-000000000000"];
      const { data: confProfs } = await supabase.from("profiles").select("user_id, nome, email, foto_url").in("user_id", safeConfIds);
      const { data: confSks } = await supabase.from("skills").select("user_id, velocidade, drible, passe, chute, resistencia, posicionamento").in("user_id", safeConfIds);
      const profMap: Record<string, { nome: string }> = {};
      const skMap: Record<string, any> = {};
      (cc || []).forEach((r: any) => {
        const pr: any = (confProfs || []).find((x: any) => x.user_id === r.user_id);
        const sk: any = (confSks || []).find((x: any) => x.user_id === r.user_id);
        profMap[r.user_id] = { nome: pr?.nome || pr?.email?.split("@")[0] || "Usuário" };
        skMap[r.user_id] = sk || {};
      });
      setProfilesMap(profMap);
      setSkillsMap(skMap);

      if (p?.sorteio_feito) {
        const { data: tms } = await supabase.from("times").select("*").eq("pelada_id", id).order("ordem");
        const { data: tj } = await supabase.from("time_jogadores").select("*").eq("pelada_id", id);
        const nomesConvidados: Record<string, string> = {};
        (conv || []).forEach((c: any) => { nomesConvidados[c.id] = `${c.nome} (convidado)`; });
        const ts = (tms || []).map((t: any) => ({
          id: t.id, nome: t.nome, cor: t.cor, ordem: t.ordem,
          membros: (tj || []).filter((x: any) => x.time_id === t.id).map((x: any): Jogador => ({
            user_id: x.user_id,
            nome: profMap[x.user_id]?.nome || nomesConvidados[x.user_id] || "Jogador",
            media: mediaSkill(skMap[x.user_id]),
            eh_goleiro: x.eh_goleiro,
          })),
        }));
        setTimes(ts);
      } else {
        setTimes([]);
      }

      if (p?.status === "em_andamento") {
        const { data: pa } = await supabase.from("partidas").select("*").eq("pelada_id", id).eq("status", "em_andamento").order("numero_partida", { ascending: false }).limit(1).maybeSingle();
        setPartidaAtual(pa || null);
      } else {
        setPartidaAtual(null);
      }

      if (p) {
        const cap = (p.jogadores_por_time + p.goleiros_por_time) * p.numero_times;
        const nConf = (cc || []).filter((c: any) => c.status === "confirmado").length;
        if (p.status === "aguardando" && nConf >= cap) {
          await supabase.from("peladas").update({ status: "confirmada" } as never).eq("id", id);
          const { data: cap_user } = await supabase.from("grupo_membros").select("user_id").eq("grupo_id", p.grupo_id).eq("papel", "capitao").eq("status", "ativo").maybeSingle();
          if (cap_user) {
            await supabase.from("notificacoes").insert({
              user_id: (cap_user as any).user_id,
              titulo: "✅ Escalação completa!",
              mensagem: `Todos os ${cap} jogadores confirmaram para "${p.nome_pelada}".`,
              link: `/peladas/${id}`,
            } as never);
          }
          setPelada({ ...p, status: "confirmada" });
        } else if (p.status === "confirmada" && nConf < cap) {
          await supabase.from("peladas").update({ status: "aguardando" } as never).eq("id", id);
          setPelada({ ...p, status: "aguardando" });
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados da pelada:", err);
      toast.error("Erro ao carregar a pelada. Puxe pra atualizar ou recarregue a página.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id, user?.id]);

  // Realtime: reaja a mudanças em partidas/peladas
  useEffect(() => {
    const ch = supabase.channel(`pelada-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "partidas", filter: `pelada_id=eq.${id}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "peladas", filter: `id=eq.${id}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    if (!partidaAtual?.iniciada_em || !partidaAtual?.duracao_minutos) { setTempoRestante(0); return; }
    const calc = () => {
      const fim = new Date(partidaAtual.iniciada_em).getTime()
        + partidaAtual.duracao_minutos * 60_000
        + (partidaAtual.tempo_pausado_total_seg || 0) * 1000;
      const agora = partidaAtual.pausada_em ? new Date(partidaAtual.pausada_em).getTime() : Date.now();
      setTempoRestante(Math.max(0, Math.floor((fim - agora) / 1000)));
    };
    calc();
    const i = setInterval(calc, 1000);
    return () => clearInterval(i);
  }, [partidaAtual?.id, partidaAtual?.iniciada_em, partidaAtual?.duracao_minutos, partidaAtual?.pausada_em, partidaAtual?.tempo_pausado_total_seg]);

  useEffect(() => {
    if (!partidaAtual?.pausada_em) { setTempoPausadoAtual(0); return; }
    const calc = () => setTempoPausadoAtual(Math.max(0, Math.floor((Date.now() - new Date(partidaAtual.pausada_em).getTime()) / 1000)));
    calc();
    const i = setInterval(calc, 1000);
    return () => clearInterval(i);
  }, [partidaAtual?.pausada_em]);

  useEffect(() => {
    if (!pelada?.aluguel_iniciado_em) { setTempoAluguelSec(0); return; }
    const tempoLocado = pelada.tempo_locado_minutos ?? 60;
    const calc = () => {
      const fim = new Date(pelada.aluguel_iniciado_em).getTime() + tempoLocado * 60_000;
      const r = Math.max(0, Math.floor((fim - Date.now()) / 1000));
      setTempoAluguelSec(r);
    };
    calc();
    const i = setInterval(calc, 1000);
    return () => clearInterval(i);
  }, [pelada?.aluguel_iniciado_em, pelada?.tempo_locado_minutos, pelada?.status]);

  const calcularProximaPartida = async () => {
    if (!pelada) return null;
    const { data: ultima } = await supabase
      .from("partidas")
      .select("numero_partida, time_a_id, time_b_id, time_fora_id, fila_espera, placar_a, placar_b")
      .eq("pelada_id", id)
      .order("numero_partida", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: tms } = await supabase.from("times").select("*").eq("pelada_id", id).order("ordem");

    if (!tms || tms.length < 2) return null;

    let timeAId: string, timeBId: string, timeForaId: string | null = null;
    let novaFila: string[] = [];
    let saidas: { entrouEm: "A" | "B"; timeQueSaiu: string }[] = [];
    let empateSorteio = false;

    if (!ultima) {
      const { data: tjGoleiros } = await supabase.from("time_jogadores").select("time_id").eq("pelada_id", id).eq("eh_goleiro", true);
      const idsComGoleiro = new Set((tjGoleiros || []).map((x: any) => x.time_id));
      const { jogam, fila } = escolherTimesIniciais(tms as any[], idsComGoleiro);
      timeAId = (jogam[0] as any).id;
      timeBId = (jogam[1] as any).id;
      novaFila = fila.map((t: any) => t.id);
      timeForaId = novaFila[0] ?? null;
    } else if (tms.length === 2) {
      const u: any = ultima;
      if (u.placar_a === u.placar_b) {
        timeAId = u.time_b_id;
        timeBId = u.time_a_id;
      } else {
        const vencedor = u.placar_a > u.placar_b ? u.time_a_id : u.time_b_id;
        const perdedor = vencedor === u.time_a_id ? u.time_b_id : u.time_a_id;
        timeAId = vencedor;
        timeBId = perdedor;
      }
      timeForaId = null;
    } else {
      const u: any = ultima;
      const filaAtual: string[] = Array.isArray(u.fila_espera) && u.fila_espera.length
        ? u.fila_espera
        : (u.time_fora_id ? [u.time_fora_id] : (tms as any[]).filter((t: any) => t.id !== u.time_a_id && t.id !== u.time_b_id).map((t: any) => t.id));

      const resultado = proximaRodada({
        timeAId: u.time_a_id,
        timeBId: u.time_b_id,
        filaAtual,
        placarA: u.placar_a,
        placarB: u.placar_b,
        numeroPartida: u.numero_partida,
        regraEmpate: (pelada as any).regra_empate_rodizio || "time_atual_sai",
      });
      if (!resultado) return null;

      timeAId = resultado.novoA;
      timeBId = resultado.novoB;
      novaFila = resultado.novaFila;
      timeForaId = novaFila[0] ?? null;
      saidas = resultado.saidas;
      empateSorteio = !!resultado.empateResolvidoPorSorteio;
    }

    return {
      timeAId, timeBId, timeForaId, novaFila, saidas,
      numeroPartida: ((ultima as any)?.numero_partida || 0) + 1,
      empateSorteio,
    };
  };

  const iniciarProximaPartida = async (preview: NonNullable<Awaited<ReturnType<typeof calcularProximaPartida>>>) => {
    const { timeAId, timeBId, timeForaId, novaFila, saidas, numeroPartida } = preview;

    for (const s of saidas) {
      const timeEntrante = s.entrouEm === "A" ? timeAId : timeBId;
      const { data: tjExistente } = await supabase.from("time_jogadores").select("id")
        .eq("pelada_id", id).eq("time_id", timeEntrante).eq("eh_goleiro", true).limit(1);
      if (!tjExistente || tjExistente.length === 0) {
        await supabase.from("time_jogadores").update({ time_id: timeEntrante } as never)
          .eq("pelada_id", id).eq("time_id", s.timeQueSaiu).eq("eh_goleiro", true);
      }
    }

    await supabase.from("partidas").insert({
      pelada_id: id,
      numero_partida: numeroPartida,
      time_a_id: timeAId,
      time_b_id: timeBId,
      time_fora_id: timeForaId,
      fila_espera: novaFila,
      placar_a: 0,
      placar_b: 0,
      status: "em_andamento",
      duracao_minutos: pelada!.duracao_partida_minutos || 8,
      iniciada_em: new Date().toISOString(),
    } as never);
    setProximaPreview(null);
    void load();
  };

  const confirmarProximaPartida = async () => {
    if (!proximaPreview) return;
    if (proximaPreview.empateSorteio) {
      const nomeTime = times.find((t) => t.id === proximaPreview.timeAId)?.nome || "Time";
      toast.info(`Empate na 1ª partida — sorteio decidiu que o ${nomeTime} fica! 🎲`);
    }
    await iniciarProximaPartida(proximaPreview);
  };

  const encerrarPeladaAuto = async () => {
    const { error: errP } = await supabase.from("partidas").update({ status: "encerrada", encerrada_em: new Date().toISOString() } as never).eq("pelada_id", id).eq("status", "em_andamento");
    if (errP) { console.error("Erro ao encerrar partidas da pelada:", errP); toast.error(`Erro ao encerrar partidas: ${errP.message} (código: ${errP.code})`); return; }
    const { error: errPel } = await supabase.from("peladas").update({ status: "encerrada" } as never).eq("id", id);
    if (errPel) { console.error("Erro ao encerrar pelada:", errPel); toast.error(`Erro ao encerrar pelada: ${errPel.message} (código: ${errPel.code})`); return; }
    void notificarVencedoresPelada(id);
    toast.success("⏱ Tempo de aluguel encerrado! Pelada finalizada.");
    setAvisoAluguelOpen(false);
    void load();
  };

  const TOLERANCIA_SEC = 180;

  useEffect(() => {
    if (loading) return;
    if (!pelada?.aluguel_iniciado_em) return;
    if (pelada?.status !== "em_andamento") return;
    if (!isCapitao) return;
    if (tempoAluguelSec !== 0) { if (avisoAluguelOpen) setAvisoAluguelOpen(false); return; }
    if (!avisoAluguelOpen) setAvisoAluguelOpen(true);
  }, [tempoAluguelSec, pelada?.status, pelada?.aluguel_iniciado_em, loading, isCapitao, avisoAluguelOpen]);

  useEffect(() => {
    if (!avisoAluguelOpen || !pelada?.aluguel_iniciado_em) return;
    const tempoLocado = pelada.tempo_locado_minutos ?? 60;
    const fimAluguel = new Date(pelada.aluguel_iniciado_em).getTime() + tempoLocado * 60_000;
    const calc = () => {
      const vencidoSec = Math.floor((Date.now() - fimAluguel) / 1000);
      const restante = Math.max(0, TOLERANCIA_SEC - vencidoSec);
      setGraceSec(restante);
      if (restante <= 0) void encerrarPeladaAuto();
    };
    calc();
    const i = setInterval(calc, 1000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avisoAluguelOpen, pelada?.aluguel_iniciado_em, pelada?.tempo_locado_minutos]);


  const registrarAtrasoAluguel = async (minutos: number) => {
    if (!pelada) return;
    const { error } = await supabase.from("peladas").update({ tempo_locado_minutos: (pelada.tempo_locado_minutos ?? 60) + minutos } as never).eq("id", id);
    if (error) { console.error("Erro ao registrar atraso:", error); toast.error(`Erro ao registrar atraso: ${error.message} (código: ${error.code})`); return; }
    setAvisoAluguelOpen(false);
    toast.success(`+${minutos}min adicionados ao aluguel da quadra`);
    void load();
  };

  const pausarPartida = async () => {
    if (!partidaAtual || partidaAtual.pausada_em || !user) return;
    const agora = new Date().toISOString();
    await supabase.from("partidas").update({ pausada_em: agora } as never).eq("id", partidaAtual.id);
    await supabase.from("lances").insert({
      partida_id: partidaAtual.id, pelada_id: id, tipo: "outro",
      descricao: "⏸️ Tempo pausado", user_id: user.id, time_id: partidaAtual.time_a_id, marcado_por: user.id,
    } as never);
    toast.info("⏸️ Tempo pausado");
    void load();
  };

  const retomarPartida = async () => {
    if (!partidaAtual?.pausada_em || !user) return;
    const segundosPausado = Math.max(0, Math.floor((Date.now() - new Date(partidaAtual.pausada_em).getTime()) / 1000));
    await supabase.from("partidas").update({
      pausada_em: null,
      tempo_pausado_total_seg: (partidaAtual.tempo_pausado_total_seg || 0) + segundosPausado,
    } as never).eq("id", partidaAtual.id);
    const mm = Math.floor(segundosPausado / 60), ss = segundosPausado % 60;
    await supabase.from("lances").insert({
      partida_id: partidaAtual.id, pelada_id: id, tipo: "outro",
      descricao: `▶️ Tempo retomado — ficou pausado por ${mm}min ${ss}s`, user_id: user.id, time_id: partidaAtual.time_a_id, marcado_por: user.id,
    } as never);
    toast.success("▶️ Tempo retomado");
    void load();
  };

  useEffect(() => {
    if (loading) return;
    if (!pelada || pelada.status !== "em_andamento" || !isCapitao) return;
    if (partidaAtual) return;
    if (proximaPreview) return;
    if (!pelada.aluguel_iniciado_em) return;
    const tempoLocado = pelada.tempo_locado_minutos ?? 60;
    const fim = new Date(pelada.aluguel_iniciado_em).getTime() + tempoLocado * 60_000;
    const restanteMin = (fim - Date.now()) / 60000;
    const dur = pelada.duracao_partida_minutos ?? 8;
    if (restanteMin >= dur * 0.5) {
      void calcularProximaPartida().then((p) => { if (p) setProximaPreview(p); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, partidaAtual, pelada?.status, isCapitao, proximaPreview]);

  useEffect(() => {
    if (loading || !partidaAtual || !isCapitao) return;
    if (partidaAtual.pausada_em) return;
    if (tempoRestante !== 0) return;
    if (partidaAtual.status !== "em_andamento") return;
    void supabase.from("partidas").update({ status: "encerrada", encerrada_em: new Date().toISOString() } as never).eq("id", partidaAtual.id).then(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempoRestante, partidaAtual?.id, partidaAtual?.pausada_em, isCapitao, loading]);


  useEffect(() => {
    if (!pelada || pelada.status !== "encerrada" || !times.length) { setResumoEncerrada(null); return; }
    void (async () => {
      const { data: partidasAll } = await supabase.from("partidas").select("time_a_id, time_b_id, placar_a, placar_b, status").eq("pelada_id", id);
      const tabela = Object.values(calcularTabela((partidasAll as any) || [], times)).sort(
        (a, b) => b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc),
      );
      const vencedorRow = tabela[0];
      const vencedorTime = vencedorRow ? times.find((t) => t.id === vencedorRow.time_id) || null : null;

      let mvpNome: string | null = null;
      if (pelada.mvp_user_id) {
        const { data: mvpProf } = await supabase.from("profiles").select("nome").eq("user_id", pelada.mvp_user_id).maybeSingle();
        mvpNome = (mvpProf as any)?.nome || null;
      }

      const { data: lancesGol } = await supabase.from("lances").select("user_id").eq("pelada_id", id).eq("tipo", "gol");
      const contagem: Record<string, number> = {};
      (lancesGol || []).forEach((l: any) => { contagem[l.user_id] = (contagem[l.user_id] || 0) + 1; });
      const topId = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a])[0];
      let artilheiroNome: string | null = null;
      let artilheiroGols = 0;
      if (topId) {
        artilheiroGols = contagem[topId];
        const timeComTop = times.find((t) => t.membros.some((m) => m.user_id === topId));
        artilheiroNome = timeComTop?.membros.find((m) => m.user_id === topId)?.nome || null;
        if (!artilheiroNome) {
          const { data: p2 } = await supabase.from("profiles").select("nome").eq("user_id", topId).maybeSingle();
          artilheiroNome = (p2 as any)?.nome || "Jogador";
        }
      }

      setResumoEncerrada({
        vencedor: vencedorTime ? { id: vencedorTime.id, nome: vencedorTime.nome, cor: vencedorTime.cor } : null,
        mvpNome, artilheiroNome, artilheiroGols,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pelada?.status, times, id]);

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!pelada) return <EmptyState icon={CircleDot} title="Pelada não encontrada" />;

  const minhaConf = confirmacoes.find((c) => c.user_id === user?.id);
  const confirmados = confirmacoes.filter((c) => c.status === "confirmado");
  const espera = confirmacoes.filter((c) => c.status === "lista_espera");
  const capacidade = (pelada.jogadores_por_time + pelada.goleiros_por_time) * pelada.numero_times;

  const confirmar = async () => {
    if (!user) return;
    setActing(true);
    if (minhaConf) {
      const { error } = await supabase.from("pelada_confirmacoes").update({ status: "confirmado" } as never).eq("id", minhaConf.id);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.from("pelada_confirmacoes").insert({ pelada_id: id, user_id: user.id, status: "confirmado" } as never);
      if (error) toast.error(error.message);
    }
    setActing(false);
    toast.success("Presença confirmada");
    void load();
  };

  const cancelar = async () => {
    if (!user || !minhaConf) return;
    let novoStatus: "recusado" | "cancelado_tarde" = "recusado";
    if (pelada.sorteio_feito) {
      if (!(await confirm({ title: "Cancelar presença", description: "Atenção: cancelar após o sorteio reduzirá seus pontos. Deseja continuar?", variant: "destructive", confirmLabel: "Cancelar mesmo assim" }))) return;
      novoStatus = "cancelado_tarde";
    }
    setActing(true);
    const { error } = await supabase.from("pelada_confirmacoes").update({ status: novoStatus } as never).eq("id", minhaConf.id);
    setActing(false);
    if (error) return toast.error(error.message);
    toast.success("Presença cancelada");
    void load();
  };

  const iniciarPelada = async (comAtraso: boolean = false) => {
    if (!pelada || !isCapitao || acting) return;
    setActing(true);
    const agora = new Date().toISOString();

    const { error: errPelada } = await supabase
      .from("peladas")
      .update({
        status: "em_andamento",
        aluguel_iniciado_em: agora,
        ...(comAtraso ? { atraso_registrado_em: agora } : {}),
      } as never)
      .eq("id", id);
    if (errPelada) { toast.error(errPelada.message); setActing(false); return; }

    const { data: tms, error: errTimes } = await supabase.from("times").select("*").eq("pelada_id", id).order("ordem");
    if (errTimes) { toast.error(errTimes.message); setActing(false); return; }
    if (!tms || tms.length < 2) { toast.error("Times não encontrados. Faça o sorteio primeiro."); setActing(false); return; }

    const { data: tjGoleiros } = await supabase.from("time_jogadores").select("time_id").eq("pelada_id", id).eq("eh_goleiro", true);
    const idsComGoleiro = new Set((tjGoleiros || []).map((x: any) => x.time_id));
    const { jogam, fila } = escolherTimesIniciais(tms as any[], idsComGoleiro);
    const filaIds = fila.map((t: any) => t.id);

    const { error: errPartida } = await supabase.from("partidas").insert({
      pelada_id: id,
      numero_partida: 1,
      time_a_id: (jogam[0] as any).id,
      time_b_id: (jogam[1] as any).id,
      time_fora_id: filaIds[0] ?? null,
      fila_espera: filaIds,
      placar_a: 0,
      placar_b: 0,
      status: "em_andamento",
      duracao_minutos: pelada.duracao_partida_minutos ?? 8,
      iniciada_em: agora,
    } as never);
    if (errPartida) { toast.error(errPartida.message); setActing(false); return; }

    toast.success(comAtraso ? "⏰ Pelada iniciada com atraso!" : "🟢 Pelada iniciada!");
    void load();
    setActing(false);
  };



  const encerrarPartida = async () => {
    if (!partidaAtual) return;
    setActing(true);
    const { error } = await supabase.from("partidas").update({ status: "encerrada", encerrada_em: new Date().toISOString() } as never).eq("id", partidaAtual.id);
    setActing(false);
    if (error) return toast.error(error.message);
    toast.success("Partida encerrada");
    void load();
  };

  const encerrarPeladaManual = async () => {
    if (!isCapitao) return;
    const restMin = Math.floor(tempoAluguelSec / 60);
    if (!(await confirm({ title: "Encerrar pelada", description: `Tem certeza que deseja encerrar a pelada? Ainda restam ${restMin}min de aluguel.`, variant: "destructive", confirmLabel: "Encerrar" }))) return;
    await encerrarPeladaAuto();
  };



  const ajustarPlacar = async (campo: "placar_a" | "placar_b", delta: number) => {
    if (!partidaAtual) return;
    const novo = Math.max(0, (partidaAtual[campo] || 0) + delta);
    const { error } = await supabase.from("partidas").update({ [campo]: novo } as never).eq("id", partidaAtual.id);
    if (error) return toast.error(error.message);
    setPartidaAtual({ ...partidaAtual, [campo]: novo });
  };

  const initials = (n: string) => n.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-[#0D0D0D] pb-6">
      <div className="relative min-h-[180px] w-full p-4" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800')", backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.3))" }} />
        <div className="relative flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate({ to: "/jogador/peladas" })} className="text-white">
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div className="font-bold text-lg"><span className="text-white">MR</span><span className="text-[#00FF87]">FUT</span></div>
            <div className="relative">
              <Bell className="h-6 w-6 text-white" />
              <div className="absolute top-0 right-0 h-2 w-2 rounded-full bg-[#00FF87]" />
            </div>
          </div>
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-white">{pelada.nome_pelada}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {pelada.data.split("-").reverse().join("/")}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {pelada.horario_inicio.slice(0,5)}</span>
              {quadra && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {quadra.nome}</span>}
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#00FF87]/40 bg-[#00FF87]/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#00FF87]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#00FF87]" />
              {pelada.status.replace("_", " ")}
            </div>
          </div>
          <Shield className="absolute right-0 top-1/2 h-20 w-20 text-[#00FF87] drop-shadow-[0_0_12px_rgba(0,255,135,0.6)]" strokeWidth={1.5} />
        </div>
      </div>

      <div className="mt-4 space-y-4 px-4">
        {times.length === 0 && (
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
            <div>
              <div className="flex items-center gap-1 mb-3 text-white font-bold"><Users className="h-4 w-4" /> Jogadores ({confirmados.length})</div>
              <div className="grid grid-cols-2 gap-2">
                {confirmados.slice(0,8).map((c) => {
                  const nome = profilesMap[c.user_id]?.nome || "Jogador";
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2A2A2A] text-xs text-white">{initials(nome)}</div>
                      <span className="text-sm truncate text-white">{nome}</span>
                    </div>
                  );
                })}
                {confirmados.length > 8 && <div className="text-xs text-muted-foreground">+ {confirmados.length - 8} outros</div>}
              </div>
            </div>
            <div className="border-l border-[#2A2A2A] pl-4">
              <div className="flex items-center gap-1 mb-3 text-white font-bold"><Clock className="h-4 w-4" /> Espera ({espera.length})</div>
              <div className="space-y-2">
                {espera.length === 0 ? <div className="text-xs text-[#888]">Nenhum na espera</div> : espera.map(c => <div key={c.id} className="text-sm text-white truncate">{profilesMap[c.user_id]?.nome}</div>)}
              </div>
            </div>
          </div>
        )}

        {times.length > 0 && pelada.status !== "em_andamento" && (
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
            <div className="flex items-center gap-1 mb-1 text-xs font-bold text-[#888]"><Users className="h-3.5 w-3.5" /> {confirmados.length} confirmados no sorteio</div>
          </div>
        )}

        {pelada.status === "em_andamento" && (() => {
          const aluguelMM = Math.floor(tempoAluguelSec / 60).toString().padStart(2, "0");
          const aluguelSS = (tempoAluguelSec % 60).toString().padStart(2, "0");
          const totalLocado = pelada.tempo_locado_minutos ?? 60;
          const decorrido = Math.max(0, totalLocado * 60 - tempoAluguelSec);
          const pct = totalLocado > 0 ? Math.min(100, Math.round((decorrido / (totalLocado * 60)) * 100)) : 0;
          return (
            <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Tempo de quadra</div>
                  <div className="text-4xl font-black text-[#00FF87] mt-1">{aluguelMM}:{aluguelSS}</div>
                  {partidaAtual && <div className="text-[10px] font-bold uppercase tracking-widest text-[#888] mt-1">Partida {partidaAtual.numero_partida}</div>}
                </div>
                <div className="h-10 w-px bg-[#2A2A2A]" />
                <div className="flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#888]">Total <span className="text-white">{Math.floor(totalLocado/60)}h{(totalLocado%60).toString().padStart(2,"0")}</span></div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-[#2A2A2A] overflow-hidden">
                    <div className="h-full bg-[#00FF87]" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] font-bold text-[#00FF87] mt-1">{pct}%</div>
                </div>
                <Shield className="h-10 w-10 text-[#00FF87]/40 shrink-0" />
              </div>
            </div>
          );
        })()}

        {times.length > 0 && (() => {
          const meuTime = times.find((t) => t.membros.some((m) => m.user_id === user?.id));
          const temRodizio = pelada.sistema_disputa === "rodizio" && times.length >= 3;
          const foraPrimeira = temRodizio ? [...times].sort((a, b) => a.ordem - b.ordem)[0] : null;
          const estaDeFora = (t: typeof times[number]) => !!foraPrimeira && t.id === foraPrimeira.id;
          const jogamPrimeiro = temRodizio ? [...times].filter((t) => !estaDeFora(t)).sort((a, b) => a.ordem - b.ordem) : [];
          const numeroTime = (t: typeof times[number]) => {
            if (!temRodizio) return t.ordem + 1;
            if (estaDeFora(t)) return times.length;
            return jogamPrimeiro.findIndex((x) => x.id === t.id) + 1;
          };
          return (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wide text-sm"><Users className="h-5 w-5" /> Times sorteados</div>

              {meuTime && (
                <div className="rounded-2xl border-2 bg-[#1A1A1A] p-4 relative overflow-hidden" style={{ borderColor: meuTime.cor }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: meuTime.cor }}>
                        <Star className="h-5 w-5" style={{ color: corTextoLegivel(meuTime.cor) }} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: corTextoLegivel(meuTime.cor) }}>Seu time</div>
                        <div className="text-lg font-black text-white leading-tight">{meuTime.nome}</div>
                      </div>
                    </div>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${estaDeFora(meuTime) ? "bg-white/10 text-[#AAA]" : "bg-[#00FF87]/20 text-[#00FF87]"}`}>{numeroTime(meuTime)}</span>
                  </div>
                  {temRodizio && estaDeFora(meuTime) && (
                    <div className="mb-2 flex items-center gap-1 text-[10px] font-bold text-[#AAA]"><User className="h-3 w-3" /> fora na 1ª rodada</div>
                  )}
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                      {meuTime.membros.map((m) => (
                        <div key={m.user_id} className="text-sm text-white">
                          {m.nome}{m.user_id === user?.id && <span className="ml-1 font-bold" style={{ color: corTextoLegivel(meuTime.cor) }}>(você)</span>}
                        </div>
                      ))}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-[#888] uppercase">Força</div>
                      <div className="text-2xl font-bold border-b-2 pb-0.5" style={{ color: corTextoLegivel(meuTime.cor), borderColor: meuTime.cor }}>{mediaTime(meuTime.membros).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 h-1" style={{ width: "100%", backgroundColor: meuTime.cor, opacity: 0.3 }} />
                  <div className="absolute bottom-0 left-0 h-1 transition-all" style={{ width: `${(mediaTime(meuTime.membros) / 5) * 100}%`, backgroundColor: meuTime.cor }} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {times.filter((t) => t !== meuTime).map((t) => (
                  <div key={t.id} className="rounded-xl border bg-[#1A1A1A] p-3 relative overflow-hidden" style={{ borderColor: t.cor }}>
                    {temRodizio && estaDeFora(t) && (
                      <span className="absolute right-3 top-3 flex items-center gap-1 text-[9px] font-bold text-[#AAA]"><User className="h-3 w-3" /> 1 fora</span>
                    )}
                    <div className="flex items-center gap-2 mb-2 font-bold text-sm" style={{ color: corTextoLegivel(t.cor) }}>
                      <div className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: t.cor }}>
                        <Shirt className="h-5 w-5 text-white" />
                      </div>
                      <span className="truncate">{t.nome}</span>
                    </div>
                    <div className="space-y-1 mb-4">
                      {t.membros.map(m => <div key={m.user_id} className="text-[11px] text-white truncate">{m.nome}</div>)}
                    </div>
                    <div className="absolute right-3 bottom-3 text-right">
                      <div className="text-[9px] text-[#888] uppercase">Força</div>
                      <div className="text-sm font-bold" style={{ color: corTextoLegivel(t.cor) }}>{mediaTime(t.membros).toFixed(2)}</div>
                    </div>
                    <div className="absolute bottom-0 left-0 h-1" style={{ width: "100%", backgroundColor: t.cor, opacity: 0.2 }} />
                    <div className="absolute bottom-0 left-0 h-1" style={{ width: `${(mediaTime(t.membros) / 5) * 100}%`, backgroundColor: t.cor }} />
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {pelada.status === "em_andamento" && partidaAtual && (() => {
          const tA = times.find((t) => t.id === partidaAtual.time_a_id);
          const tB = times.find((t) => t.id === partidaAtual.time_b_id);
          const aluguelMM = Math.floor(tempoAluguelSec / 60).toString().padStart(2, "0");
          const aluguelSS = (tempoAluguelSec % 60).toString().padStart(2, "0");
          const partidaMM = Math.floor(tempoRestante / 60).toString().padStart(2, "0");
          const partidaSS = (tempoRestante % 60).toString().padStart(2, "0");
          return (
            <div className="rounded-2xl border border-[#00FF87] bg-[#1A1A1A] p-5">
              <div className="text-center text-[#00FF87] font-bold text-xs uppercase tracking-widest mb-2">PARTIDA {partidaAtual.numero_partida} EM ANDAMENTO</div>
              <div className="text-center text-[10px] text-[#888] mb-4">⏱ Aluguel: {aluguelMM}:{aluguelSS}</div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 text-center">
                  <div className="text-sm font-bold truncate mb-2" style={{ color: tA?.cor }}>{tA?.nome}</div>
                  <div className="text-5xl font-black text-white">{partidaAtual.placar_a}</div>
                  {isCapitao && (
                    <div className="flex justify-center gap-2 mt-2">
                      <button onClick={() => ajustarPlacar("placar_a", -1)} className="h-8 w-8 rounded-full border border-[#2A2A2A] text-white">-</button>
                      <button onClick={() => ajustarPlacar("placar_a", 1)} className="h-8 w-8 rounded-full border border-[#2A2A2A] text-white">+</button>
                    </div>
                  )}
                </div>
                
                <div className="text-center px-4">
                  <div className="text-2xl font-mono font-bold text-white mb-1">{partidaMM}:{partidaSS}</div>
                  <div className="h-1 w-12 bg-[#2A2A2A] mx-auto rounded-full overflow-hidden">
                    <div className="h-full bg-[#00FF87]" style={{ width: `${(tempoRestante / (partidaAtual.duracao_minutos * 60)) * 100}%` }} />
                  </div>
                  {partidaAtual.pausada_em && (
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                      ⏸ pausado há {Math.floor(tempoPausadoAtual / 60).toString().padStart(2, "0")}:{(tempoPausadoAtual % 60).toString().padStart(2, "0")}
                    </div>
                  )}
                  {isCapitao && (
                    partidaAtual.pausada_em ? (
                      <button onClick={retomarPartida} className="mt-2 rounded-full border border-[#00FF87] px-3 py-1 text-[10px] font-bold text-[#00FF87]">▶ Retomar</button>
                    ) : (
                      <button onClick={pausarPartida} className="mt-2 rounded-full border border-[#2A2A2A] px-3 py-1 text-[10px] font-bold text-white">⏸ Pausar</button>
                    )
                  )}
                </div>

                <div className="flex-1 text-center">
                  <div className="text-sm font-bold truncate mb-2" style={{ color: tB?.cor }}>{tB?.nome}</div>
                  <div className="text-5xl font-black text-white">{partidaAtual.placar_b}</div>
                  {isCapitao && (
                    <div className="flex justify-center gap-2 mt-2">
                      <button onClick={() => ajustarPlacar("placar_b", -1)} className="h-8 w-8 rounded-full border border-[#2A2A2A] text-white">-</button>
                      <button onClick={() => ajustarPlacar("placar_b", 1)} className="h-8 w-8 rounded-full border border-[#2A2A2A] text-white">+</button>
                    </div>
                  )}
                </div>
              </div>

              {isCapitao && (
                <div className="mt-6 space-y-2">
                  <Button onClick={encerrarPartida} className="w-full bg-[#CC0000] hover:bg-[#AA0000] text-white font-bold h-12 rounded-xl">Encerrar Partida</Button>
                  <Button onClick={encerrarPeladaManual} variant="outline" className="w-full border-[#CC0000] text-[#CC0000] hover:bg-[#CC0000]/10 h-10 rounded-xl">🛑 Encerrar Pelada</Button>
                </div>
              )}
            </div>
          );
        })()}

        <div className="grid grid-cols-2 gap-3">
          {(!minhaConf || (minhaConf.status !== "confirmado" && minhaConf.status !== "lista_espera")) ? (
            <Button onClick={confirmar} disabled={acting} className="col-span-2 bg-[#00FF87] text-black font-bold uppercase tracking-wide h-13 rounded-xl"><Check className="mr-2 h-5 w-5" /> Confirmar presença</Button>
          ) : minhaConf?.status === "confirmado" ? (
            <>
              <Button disabled className="bg-green-900/30 text-[#00FF87] border border-green-900/50 font-bold uppercase tracking-wide h-13 rounded-xl"><Check className="mr-2 h-5 w-5" /> Presença confirmada ✓</Button>
              <Button onClick={cancelar} disabled={acting} className="bg-[#CC0000] text-white font-bold uppercase tracking-wide h-13 rounded-xl"><X className="mr-2 h-5 w-5" /> Cancelar</Button>
            </>
          ) : (
            <>
              <Button disabled className="bg-yellow-900/30 text-yellow-500 border border-yellow-900/50 font-bold uppercase tracking-wide h-13 rounded-xl">Em lista de espera</Button>
              <Button onClick={cancelar} disabled={acting} className="bg-[#CC0000] text-white font-bold uppercase tracking-wide h-13 rounded-xl"><X className="mr-2 h-5 w-5" /> Sair</Button>
            </>
          )}

          {!pelada.sorteio_feito && isCapitao && (confirmados.length + convidados.length) >= pelada.numero_times * 2 && (
            <Button onClick={() => navigate({ to: "/peladas/$id/sorteio", params: { id } })} className="col-span-2 bg-[#00FF87] text-black font-bold uppercase tracking-wide h-13 rounded-xl"><Dice5 className="mr-2 h-5 w-5" /> Sortear Times</Button>
          )}

          {isCapitao && pelada.sorteio_feito && pelada.status !== "em_andamento" && pelada.status !== "encerrada" && (
            <Button onClick={() => iniciarPelada(false)} disabled={acting} className="col-span-2 bg-[#00FF87] text-black font-bold uppercase tracking-wide h-13 rounded-xl"><Play className="mr-2 h-5 w-5" /> Iniciar Pelada</Button>
          )}

          {isCapitao && pelada.status !== "encerrada" && (
            <div className="col-span-2 grid grid-cols-3 gap-2">
              <button onClick={() => setPresencasOpen(true)} className="flex flex-col items-center gap-1.5 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] py-3 text-[#00FF87]">
                <Users className="h-5 w-5" />
                <span className="text-[9px] font-bold uppercase tracking-wide text-white text-center leading-tight">Gerenciar<br />presenças</span>
              </button>
              {pelada.sorteio_feito && (
                <button onClick={() => navigate({ to: "/peladas/$id/sorteio", params: { id } })} className="flex flex-col items-center gap-1.5 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] py-3 text-[#00FF87]">
                  <RefreshCw className="h-5 w-5" />
                  <span className="text-[9px] font-bold uppercase tracking-wide text-white text-center leading-tight">Refazer<br />sorteio</span>
                </button>
              )}
              {pelada.status === "em_andamento" && (
                <Link to="/peladas/$id/lances" params={{ id }} className="flex flex-col items-center gap-1.5 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] py-3 text-[#00FF87]">
                  <Shield className="h-5 w-5" />
                  <span className="text-[9px] font-bold uppercase tracking-wide text-white text-center leading-tight">Painel de<br />lances</span>
                </Link>
              )}
            </div>
          )}

          {!isCapitao && pelada.status === "em_andamento" && (
            <Button asChild className="col-span-2 bg-[#1A1A1A] border border-[#2A2A2A] text-white uppercase tracking-wide h-12 rounded-xl">
              <Link to="/peladas/$id/lances" params={{ id }}><ClipboardList className="mr-2 h-4 w-4" /> Painel de Lances</Link>
            </Button>
          )}

          {pelada.status === "encerrada" && (() => {
            const vencedor = resumoEncerrada?.vencedor;
            const corVenc = vencedor ? corTextoLegivel(vencedor.cor, "#9CA3AF") : "#00FF87";
            const souVencedor = !!vencedor && times.find((t) => t.id === vencedor.id)?.membros.some((m) => m.user_id === user?.id);
            return (
              <div className="col-span-2 space-y-4">
                {vencedor && (
                  <div
                    className="rounded-2xl border-2 p-5 text-center"
                    style={{ borderColor: vencedor.cor, background: `linear-gradient(135deg, ${vencedor.cor}22, #1A1A1A)` }}
                  >
                    <Crown className="mx-auto h-8 w-8" style={{ color: corVenc }} />
                    <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Time vencedor</div>
                    <div className="mt-1 text-2xl font-black" style={{ color: corVenc }}>{vencedor.nome}</div>
                    <div className="text-xs text-gray-400">campeão da rodada</div>
                  </div>
                )}

                {souVencedor && (
                  <div className="rounded-xl border border-[#00FF87]/40 bg-[#00FF87]/10 p-3 text-center text-sm font-bold text-[#00FF87]">
                    🎉 Parabéns! Seu time foi o campeão dessa pelada!
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {pelada.avaliacao_aberta && (
                    <Link to="/peladas/$id/avaliar" params={{ id }} className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3">
                      <Star className="h-5 w-5 text-[#00FF87]" />
                      <div className="mt-2 text-sm font-bold text-white">Avaliar Jogadores</div>
                      <div className="text-[10px] text-gray-400">Dê suas notas, escolha o MVP e ganhe XP</div>
                      <div className="mt-2 flex justify-end text-[#00FF87]"><ChevronRight className="h-4 w-4" /></div>
                    </Link>
                  )}
                  <Link to="/peladas/$id/card" params={{ id }} className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3">
                    <Trophy className="h-5 w-5 text-[#00FF87]" />
                    <div className="mt-2 text-sm font-bold text-white">Card da Vitória</div>
                    <div className="text-[10px] text-gray-400">Gere e compartilhe com o time</div>
                    <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-bold text-[#00FF87]">Compartilhe <ChevronRight className="h-4 w-4" /></div>
                  </Link>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-bold text-white">Estatísticas</div>
                    <button onClick={() => { setStatsInitialTab("times"); setStatsOpen(true); }} className="flex items-center gap-1 text-xs font-bold text-[#00FF87]">
                      Ver tudo <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => { setStatsInitialTab("times"); setStatsOpen(true); }} className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3 text-left">
                      <Users className="h-5 w-5 text-[#00FF87]" />
                      <div className="mt-2 text-sm font-bold text-white">Times</div>
                      <div className="text-[10px] text-gray-400">Ranking e pontos</div>
                    </button>
                    <button onClick={() => { setStatsInitialTab("artilheiros"); setStatsOpen(true); }} className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3 text-left">
                      <span className="text-lg">⚽</span>
                      <div className="mt-2 text-sm font-bold text-white">Artilheiros</div>
                      <div className="text-[10px] text-gray-400">Quem fez os gols</div>
                    </button>
                    <button onClick={() => { setStatsInitialTab("partidas"); setStatsOpen(true); }} className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3 text-left">
                      <ClipboardList className="h-5 w-5 text-[#00FF87]" />
                      <div className="mt-2 text-sm font-bold text-white">Partidas</div>
                      <div className="text-[10px] text-gray-400">Resumo dos jogos</div>
                    </button>
                    <button onClick={() => { setStatsInitialTab("goleiros"); setStatsOpen(true); }} className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3 text-left">
                      <Hand className="h-5 w-5 text-[#00FF87]" />
                      <div className="mt-2 text-sm font-bold text-white">Goleiros</div>
                      <div className="text-[10px] text-gray-400">Menos e mais vazados</div>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Resumo rápido</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <Star className="mx-auto h-4 w-4 text-[#FACC15]" />
                      <div className="mt-1 text-[10px] uppercase text-gray-400">MVP</div>
                      <div className="truncate text-xs font-bold text-white">{resumoEncerrada?.mvpNome || "—"}</div>
                    </div>
                    <div>
                      <Crown className="mx-auto h-4 w-4 text-[#00FF87]" />
                      <div className="mt-1 text-[10px] uppercase text-gray-400">Líder</div>
                      <div className="truncate text-xs font-bold text-white">{vencedor?.nome || "—"}</div>
                    </div>
                    <div>
                      <span className="text-sm">⚽</span>
                      <div className="mt-1 text-[10px] uppercase text-gray-400">Destaque</div>
                      <div className="truncate text-xs font-bold text-white">{resumoEncerrada?.artilheiroGols ? `${resumoEncerrada.artilheiroGols} gols` : "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <StatsPeladaModal open={statsOpen} onOpenChange={setStatsOpen} peladaId={id} />

      <GerenciarPresencasModal
        open={presencasOpen}
        onOpenChange={(v) => { setPresencasOpen(v); if (!v) void load(); }}
        peladaId={id}
        grupoId={pelada.grupo_id}
        capacidade={capacidade}
      />

      <SorteioModal
        open={sorteioOpen}
        onOpenChange={setSorteioOpen}
        peladaId={id}
        numeroTimes={pelada.numero_times}
        jogadoresPorTime={pelada.jogadores_por_time}
        onDone={() => { setSorteioOpen(false); void load(); }}
      />

      <AlertDialog open={!!proximaPreview && !partidaAtual && pelada.status === "em_andamento" && isCapitao} onOpenChange={(v) => { if (!v) setProximaPreview(null); }}>
        <AlertDialogContent className="bg-[#0D0D0D] border-[#2A2A2A] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">🏁 Partida encerrada!</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-[#CCC]">
                {proximaPreview && (
                  <div className="text-base font-bold text-white">
                    Próxima partida: {times.find((t) => t.id === proximaPreview.timeAId)?.nome || "Time"}{" "}x{" "}
                    {times.find((t) => t.id === proximaPreview.timeBId)?.nome || "Time"}
                  </div>
                )}
                <p>Quando o time estiver pronto, toque em "Iniciar Partida".</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={confirmarProximaPartida} className="bg-[#00FF87] text-black hover:bg-[#00E676] font-bold">
              ▶ Iniciar Partida
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={avisoAluguelOpen} onOpenChange={(v) => { if (!v) setAvisoAluguelOpen(false); }}>
        <AlertDialogContent className="bg-[#0D0D0D] border-[#CC0000] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">⏰ O horário da pelada acabou!</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-[#CCC]">
                <p>O tempo de aluguel configurado já passou. O que você quer fazer?</p>
                <p className="text-yellow-400 font-bold">
                  Se ninguém decidir nada, a pelada encerra sozinha em {Math.floor(graceSec / 60)}:{(graceSec % 60).toString().padStart(2, "0")}.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction onClick={() => registrarAtrasoAluguel(15)} className="w-full bg-white/10 text-white hover:bg-white/20">
              + 15 min de atraso
            </AlertDialogAction>
            <AlertDialogAction onClick={() => registrarAtrasoAluguel(30)} className="w-full bg-white/10 text-white hover:bg-white/20">
              + 30 min de atraso
            </AlertDialogAction>
            <AlertDialogCancel onClick={encerrarPeladaAuto} className="w-full bg-[#CC0000] text-white hover:bg-[#AA0000] border-0">
              Encerrar pelada agora
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


const CORES_2 = [
  { nome: "Amarelo", cor: "#FACC15" },
  { nome: "Azul", cor: "#3B82F6" },
];
const CORES_3 = [
  { nome: "Amarelo", cor: "#FACC15" },
  { nome: "Vermelho", cor: "#EF4444" },
  { nome: "Preto", cor: "#111827" },
];
const CORES_N = [
  { nome: "Amarelo", cor: "#FACC15" },
  { nome: "Azul", cor: "#3B82F6" },
  { nome: "Vermelho", cor: "#EF4444" },
  { nome: "Preto", cor: "#111827" },
  { nome: "Verde", cor: "#22C55E" },
  { nome: "Roxo", cor: "#A855F7" },
];

type SortJogador = { user_id: string; nome: string; nivel: number };

function sortearSerpentina(jogadores: SortJogador[], n: number): SortJogador[][] {
  const ordenados = [...jogadores].sort((a, b) => b.nivel - a.nivel);
  const times: SortJogador[][] = Array.from({ length: n }, () => []);
  ordenados.forEach((j, i) => {
    const ciclo = Math.floor(i / n);
    const pos = i % n;
    const idx = ciclo % 2 === 0 ? pos : n - 1 - pos;
    times[idx].push(j);
  });
  return times;
}

function SorteioModal({
  open, onOpenChange, peladaId, numeroTimes, jogadoresPorTime, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  peladaId: string;
  numeroTimes: number;
  jogadoresPorTime: number;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [jogadores, setJogadores] = useState<SortJogador[]>([]);
  const [nomes, setNomes] = useState<string[]>([]);
  const [seed, setSeed] = useState(0);

  const paleta = useMemo(() => {
    if (numeroTimes === 2) return CORES_2;
    if (numeroTimes === 3) return CORES_3;
    return Array.from({ length: numeroTimes }, (_, i) => CORES_N[i % CORES_N.length]);
  }, [numeroTimes]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: confs } = await supabase
        .from("pelada_confirmacoes")
        .select("user_id, status")
        .eq("pelada_id", peladaId)
        .eq("status", "confirmado");
      const ids = (confs || []).map((c: any) => c.user_id);
      const safe = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
      const { data: profs } = await supabase
        .from("profiles").select("user_id, nome, email").in("user_id", safe);
      const { data: sks } = await supabase
        .from("skills").select("user_id, velocidade, drible, passe, chute, resistencia, posicionamento").in("user_id", safe);
      const lista: SortJogador[] = ids.map((uid) => {
        const p: any = (profs || []).find((x: any) => x.user_id === uid);
        const s: any = (sks || []).find((x: any) => x.user_id === uid);
        const nivel = s ? (s.velocidade + s.drible + s.passe + s.chute + s.resistencia + s.posicionamento) / 6 : 3;
        return { user_id: uid, nome: p?.nome || p?.email?.split("@")[0] || "Jogador", nivel };
      });
      setJogadores(lista);
      setNomes(paleta.map((p) => `Time ${p.nome}`));
      setLoading(false);
    })();
  }, [open, peladaId, paleta]);

  const times = useMemo(() => {
    void seed;
    return sortearSerpentina(jogadores, numeroTimes);
  }, [jogadores, numeroTimes, seed]);

  const regerar = () => {
    setJogadores((prev) => prev.map((j) => ({ ...j, nivel: j.nivel + (Math.random() - 0.5) * 0.001 })));
    setSeed((s) => s + 1);
  };

  const confirmar = async () => {
    setSaving(true);
    try {
      await supabase.from("time_jogadores").delete().eq("pelada_id", peladaId);
      await supabase.from("times").delete().eq("pelada_id", peladaId);
      for (let i = 0; i < numeroTimes; i++) {
        const { data: t, error } = await supabase
          .from("times")
          .insert({ pelada_id: peladaId, nome: nomes[i], cor: paleta[i].cor, ordem: i } as never)
          .select("id").single();
        if (error || !t) throw error || new Error("Erro ao criar time");
        const rows = times[i].map((j) => ({
          time_id: (t as any).id, pelada_id: peladaId, user_id: j.user_id, eh_goleiro: false,
        }));
        if (rows.length) {
          const { error: e2 } = await supabase.from("time_jogadores").insert(rows as never);
          if (e2) throw e2;
        }
      }
      const { error: ep } = await supabase.from("peladas").update({ sorteio_feito: true } as never).eq("id", peladaId);
      if (ep) throw ep;
      toast.success("Times sorteados com sucesso!");
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar sorteio");
    } finally {
      setSaving(false);
    }
  };

  const minimo = jogadoresPorTime * numeroTimes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Sorteio de Times</DialogTitle></DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando confirmados...</p>
        ) : jogadores.length < minimo ? (
          <p className="text-sm text-muted-foreground">
            Necessário ao menos {minimo} confirmados ({jogadores.length} atualmente).
          </p>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">
              {jogadores.length} jogadores · {numeroTimes} times (algoritmo serpentina por nível)
            </div>
            {times.map((t, i) => (
              <div key={i} className="rounded-xl border-2 p-3" style={{ borderColor: paleta[i].cor, background: `${paleta[i].cor}11` }}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full border" style={{ background: paleta[i].cor }} />
                  <Input
                    value={nomes[i] || ""}
                    onChange={(e) => setNomes((p) => p.map((n, k) => k === i ? e.target.value : n))}
                    className="h-8 max-w-[220px]"
                  />
                  <span className="ml-auto text-xs font-bold text-primary">
                    {t.length ? (t.reduce((a, j) => a + j.nivel, 0) / t.length).toFixed(2) : "—"}
                  </span>
                </div>
                <div className="grid gap-1 text-sm">
                  {t.map((j) => (
                    <div key={j.user_id} className="flex justify-between">
                      <span>{j.nome}</span>
                      <span className="text-xs text-muted-foreground">nv {j.nivel.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={regerar} disabled={loading || saving || jogadores.length < minimo}>
            <RefreshCw className="mr-2 h-4 w-4" /> Regerar
          </Button>
          <Button onClick={confirmar} disabled={loading || saving || jogadores.length < minimo} className="bg-primary text-primary-foreground font-bold">
            {saving ? "Salvando..." : "Confirmar Sorteio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
