import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { ArrowLeft, Trash2, Home, CircleDot, Trophy, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { sugerirTrocaGoleiro } from "@/lib/sorteio";

export const Route = createFileRoute("/peladas/$id/lances")({ component: Wrapper });

const items = [
  { to: "/jogador", label: "Início", icon: Home },
  { to: "/jogador/peladas", label: "Peladas", icon: CircleDot },
  { to: "/jogador/ranking", label: "Ranking", icon: Trophy },
  { to: "/jogador/perfil", label: "Perfil", icon: User },
];

const TIPOS = [
  { v: "gol", label: "GOL", icon: "⚽" },
  { v: "passe_decisivo", label: "PASSE", icon: "🤝" },
  { v: "defesa", label: "DEFESA", icon: "🧤" },
  { v: "falta", label: "FALTA", icon: "🟨" },
  { v: "outro", label: "OUTRO", icon: "•" },
] as const;

function Wrapper() {
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <MobileShell items={items as any}><LancesPage /></MobileShell>
    </RequireAuth>
  );
}

function LancesPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [partida, setPartida] = useState<any>(null);
  const [times, setTimes] = useState<any[]>([]);
  const [timeJogadores, setTimeJogadores] = useState<any[]>([]);
  const [lances, setLances] = useState<any[]>([]);
  const [auxiliar, setAuxiliar] = useState<any>(null);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [tipoSel, setTipoSel] = useState<string | null>(null);
  const [timeSel, setTimeSel] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [isCapitao, setIsCapitao] = useState(false);
  const [encerrando, setEncerrando] = useState(false);


  const load = async () => {
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
    const { data: pelada } = await supabase.from("peladas").select("grupo_id").eq("id", id).maybeSingle();
    if (pelada && user) {
      const { data: membro } = await supabase.from("grupo_membros")
        .select("papel")
        .eq("grupo_id", pelada.grupo_id)
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

  const ehAuxiliar = isCapitao || (auxiliar && auxiliar.user_id === user?.id);
  const restanteSec = useMemo(() => {
    if (!partida?.iniciada_em || partida.status !== "em_andamento") return partida ? partida.duracao_minutos * 60 : 0;
    const ini = new Date(partida.iniciada_em).getTime();
    return Math.max(0, partida.duracao_minutos * 60 - Math.floor((now - ini) / 1000));
  }, [partida, now]);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const nomeTime = (tid: string) => times.find((t) => t.id === tid)?.nome || "—";
  const timeA = partida && times.find((t) => t.id === partida.time_a_id);
  const timeB = partida && times.find((t) => t.id === partida.time_b_id);

  const jogadoresDoTime = (tid: string) => timeJogadores.filter((x) => x.time_id === tid);

  const encerrarPartidaAuto = async () => {
    if (!partida || encerrando) return;
    setEncerrando(true);
    const { data: p }: any = await supabase.from("partidas").select("*").eq("id", partida.id).single();
    const vencedor = p.placar_a > p.placar_b ? p.time_a_id : p.placar_b > p.placar_a ? p.time_b_id : null;
    const { data: pel }: any = await supabase.from("peladas").select("*").eq("id", id).single();

    // Aplica sugestão de troca de goleiro ANTES de encerrar (main page cria próxima via realtime)
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
    if (!partida || !user || !tipoSel || !timeSel) return;
    const { error } = await supabase.from("lances").insert({
      partida_id: partida.id, pelada_id: id, tipo: tipoSel, user_id: userId, time_id: timeSel, marcado_por: user.id,
    } as never);
    if (error) toast.error(error.message);
    else toast.success("Lance marcado");
    setTipoSel(null); setTimeSel(null);

    if (tipoSel === "gol") {
      const { data: p }: any = await supabase.from("partidas").select("placar_a, placar_b").eq("id", partida.id).single();
      const { data: pel }: any = await supabase.from("peladas").select("gols_para_encerrar").eq("id", id).single();
      if (pel?.gols_para_encerrar && (p.placar_a >= pel.gols_para_encerrar || p.placar_b >= pel.gols_para_encerrar)) {
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
      <div className="space-y-3">
        <Link to="/peladas/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
        <div className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">Nenhuma partida em andamento.</div>
      </div>
    );
  }

  if (!ehAuxiliar) {
    return (
      <div className="space-y-3">
        <Link to="/peladas/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm">Você não é o auxiliar desta partida. Apenas pode visualizar.</p>
          <div className="mt-3 text-center text-3xl font-black">{partida.placar_a} x {partida.placar_b}</div>
          <div className="mt-1 text-center text-xs text-muted-foreground">{nomeTime(partida.time_a_id)} vs {nomeTime(partida.time_b_id)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Link to="/peladas/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Voltar</Link>


      <div className="rounded-2xl border border-border bg-card p-4 text-center">
        {restanteSec > 0 && restanteSec <= 30 && (
          <div className="mb-2 text-sm font-bold text-red-500 animate-pulse">⚡ {restanteSec}s restantes</div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex-1"><div className="text-xs text-muted-foreground">{nomeTime(partida.time_a_id)}</div><div className="text-4xl font-black text-primary">{partida.placar_a}</div></div>
          <div className={`text-2xl font-black tabular-nums ${restanteSec <= 30 ? "text-red-500 animate-pulse" : restanteSec <= 120 ? "text-red-500" : ""}`}>{fmt(restanteSec)}</div>
          <div className="flex-1"><div className="text-xs text-muted-foreground">{nomeTime(partida.time_b_id)}</div><div className="text-4xl font-black text-primary">{partida.placar_b}</div></div>
        </div>
      </div>

      {!tipoSel ? (
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((t) => (
            <Button key={t.v} onClick={() => setTipoSel(t.v)} className="h-16 bg-secondary text-foreground text-base font-bold hover:bg-secondary/80">
              <span className="mr-2 text-2xl">{t.icon}</span>{t.label}
            </Button>
          ))}
        </div>
      ) : !timeSel ? (
        <div className="space-y-2">
          <p className="text-sm font-bold">De qual time?</p>
          {[timeA, timeB].filter(Boolean).map((t: any) => (
            <Button key={t.id} onClick={() => setTimeSel(t.id)} className="h-14 w-full text-base font-bold" style={{ background: t.cor, color: "#000" }}>
              {t.nome}
            </Button>
          ))}
          <Button variant="ghost" onClick={() => setTipoSel(null)} className="w-full">Cancelar</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-bold">Qual jogador?</p>
          <div className="grid gap-2">
            {jogadoresDoTime(timeSel).map((j) => (
              <Button key={j.user_id} onClick={() => marcar(j.user_id)} className="h-14 justify-start bg-secondary text-foreground font-bold hover:bg-secondary/80">
                {j.eh_goleiro ? "🧤 " : ""}{profiles[j.user_id]?.nome || "Jogador"}
              </Button>
            ))}
          </div>
          <Button variant="ghost" onClick={() => setTimeSel(null)} className="w-full">Voltar</Button>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Lances ({lances.length})</h3>
        {lances.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum lance marcado.</p>
        ) : (
          <div className="grid gap-1">
            {lances.map((l) => {
              const tipo = TIPOS.find((t) => t.v === l.tipo);
              return (
                <div key={l.id} className="flex items-center gap-2 rounded bg-secondary/40 px-2 py-1.5 text-sm">
                  <span className="text-lg">{tipo?.icon}</span>
                  <span className="flex-1">{profiles[l.user_id]?.nome || "—"} — {nomeTime(l.time_id)}</span>
                  <span className="text-xs text-muted-foreground">{new Date(l.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <button onClick={() => excluir(l.id)} className="text-muted-foreground hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
