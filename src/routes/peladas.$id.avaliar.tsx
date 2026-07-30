import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { ArrowLeft, CheckCircle2, Lock, PartyPopper } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import confetti from "canvas-confetti";

export const Route = createFileRoute("/peladas/$id/avaliar")({
  component: Wrapper,
});

function Wrapper() {
  const { user } = useAuth();
  return (
    <RequireAuth allow={["jogador", "capitao", "admin"]}>
      <MobileShell items={getNavItems(user?.role)}><Avaliar /></MobileShell>
    </RequireAuth>
  );
}

type Ja = {
  user_id: string;
  nome: string;
  time_nome?: string;
  eh_goleiro: boolean;
  ehConvidado?: boolean;
  gols: number; passes: number; defesas: number;
  nota_geral: number; nota_comportamento: number;
  desempenho: number;
  // skills específicas de goleiro — só usadas quando eh_goleiro é true
  reflexo: number; seguranca: number; jogo_aereo: number;
  saida_pes: number; posicionamento_gk: number; comando_area: number;
};

const SKILLS_GOLEIRO: { key: "reflexo" | "seguranca" | "jogo_aereo" | "saida_pes" | "posicionamento_gk" | "comando_area"; label: string; caption: string }[] = [
  { key: "reflexo", label: "Reflexo", caption: "Pega bola difícil, defesa na trave" },
  { key: "seguranca", label: "Segurança", caption: "Pega firme, não solta rebote perigoso" },
  { key: "jogo_aereo", label: "Jogo aéreo", caption: "Sai bem nos cruzamentos e bolas altas" },
  { key: "saida_pes", label: "Saída com os pés", caption: "Sabe sair jogando, passe curto e longo" },
  { key: "posicionamento_gk", label: "Posicionamento", caption: "Se coloca bem no gol, fecha ângulo" },
  { key: "comando_area", label: "Comando de área", caption: "Organiza a defesa, avisa os companheiros" },
];

const DESEMPENHO_LABELS = ["", "Muito abaixo", "Abaixo", "Como esperado", "Acima", "Muito acima"];

const CATEGORIAS_RESENHA = [
  { v: "craque", label: "Craque da Rodada", emoji: "⚽" },
  { v: "pereba", label: "Pereba da Rodada", emoji: "🥴" },
  { v: "perde_gol", label: "Perde-Gol da Rodada", emoji: "🎯" },
  { v: "frangueiro", label: "Frangueiro da Rodada", emoji: "🐔" },
  { v: "racudo", label: "Raçudo da Rodada", emoji: "🔥" },
] as const;

function Avaliar() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pelada, setPelada] = useState<any>(null);
  const [jogadores, setJogadores] = useState<Ja[]>([]);
  const [mvp, setMvp] = useState<string>("");
  const [votosResenha, setVotosResenha] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // controle de confirmação por jogador
  const [confirmados, setConfirmados] = useState<Record<string, { xp?: number }>>({});
  const [confirmando, setConfirmando] = useState<Record<string, boolean>>({});
  const [ordemConfirmacao, setOrdemConfirmacao] = useState<string[]>([]);
  const [xpModal, setXpModal] = useState<{ bonus: number; totalSessao: number } | null>(null);
  const xpSessaoRef = useRef(0);
  const [jaEnviouVotos, setJaEnviouVotos] = useState(false);
  // rastreia se a pessoa realmente mexeu em cada slider — como o slider sempre
  // fica em algum valor de 1 a 5, não dá mais pra usar "valor zerado" como sinal
  // de "ainda não avaliei". Sem isso, dava pra confirmar sem querer.
  const [tocados, setTocados] = useState<Record<string, Set<string>>>({});
  const marcarTocado = (uid: string, campo: string) => {
    setTocados((prev) => {
      const atual = new Set(prev[uid] || []);
      atual.add(campo);
      return { ...prev, [uid]: atual };
    });
  };
  const foiTocado = (uid: string, campo: string) => tocados[uid]?.has(campo) ?? false;

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
      setPelada(p);
      const { data: tj } = await supabase.from("time_jogadores").select("user_id,time_id,eh_goleiro").eq("pelada_id", id);
      const uids = Array.from(new Set((tj || []).map((x: any) => x.user_id))).filter((u) => u !== user.id);
      const timeIds = Array.from(new Set((tj || []).map((x: any) => x.time_id)));
      const [{ data: profs }, { data: times }, { data: lances }, { data: existentes }, { data: existentesSkill }, { data: existentesGoleiro }, { data: mvpExistente }, { data: resenhaExistente }, { data: convidados }] = await Promise.all([
        supabase.from("profiles").select("user_id,nome").in("user_id", uids.length ? uids : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("times").select("id,nome").in("id", timeIds.length ? timeIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("lances").select("user_id,tipo").eq("pelada_id", id),
        supabase.from("avaliacoes_pos_pelada").select("avaliado_id,nota_geral,nota_comportamento,gols_confirmados,passes_confirmados,defesas_confirmadas").eq("pelada_id", id).eq("avaliador_id", user.id),
        (supabase as any).from("avaliacoes_skill_membro").select("avaliado_id,nota_desempenho_geral").eq("pelada_id", id).eq("avaliador_id", user.id).eq("tipo", "pos_pelada"),
        (supabase as any).from("avaliacoes_goleiro_pos_pelada").select("avaliado_id,reflexo,seguranca,jogo_aereo,saida_pes,posicionamento,comando_area").eq("pelada_id", id).eq("avaliador_id", user.id),
        supabase.from("mvp_votos").select("votado_id").eq("pelada_id", id).eq("votante_id", user.id).maybeSingle(),
        (supabase as any).from("resenha_votos").select("categoria,votado_id").eq("pelada_id", id).eq("votante_id", user.id),
        supabase.from("pelada_convidados").select("id,nome").eq("pelada_id", id),
      ]);
      if (mvpExistente) setMvp((mvpExistente as any).votado_id);
      if (resenhaExistente?.length) {
        const rMap: Record<string, string> = {};
        (resenhaExistente as any[]).forEach((r) => { rMap[r.categoria] = r.votado_id; });
        setVotosResenha(rMap);
      }
      if (mvpExistente || resenhaExistente?.length) setJaEnviouVotos(true);
      const pMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { pMap[p.user_id] = p.nome; });
      const convidadosMap: Record<string, boolean> = {};
      (convidados || []).forEach((c: any) => { pMap[c.id] = c.nome; convidadosMap[c.id] = true; });
      const tMap: Record<string, string> = {};
      (times || []).forEach((t: any) => { tMap[t.id] = t.nome; });
      const userTime: Record<string, string> = {};
      const goleiroMap: Record<string, boolean> = {};
      (tj || []).forEach((x: any) => { userTime[x.user_id] = tMap[x.time_id] || ""; goleiroMap[x.user_id] = !!x.eh_goleiro; });
      const stats: Record<string, { g: number; p: number; d: number }> = {};
      (lances || []).forEach((l: any) => {
        const s = stats[l.user_id] = stats[l.user_id] || { g: 0, p: 0, d: 0 };
        if (l.tipo === "gol") s.g++;
        else if (l.tipo === "passe_decisivo") s.p++;
        else if (l.tipo === "defesa") s.d++;
      });
      const existentesMap: Record<string, any> = {};
      (existentes || []).forEach((e: any) => { existentesMap[e.avaliado_id] = e; });
      const skillMap: Record<string, any> = {};
      (existentesSkill || []).forEach((e: any) => { skillMap[e.avaliado_id] = e; });
      const skillGoleiroMap: Record<string, any> = {};
      (existentesGoleiro || []).forEach((e: any) => { skillGoleiroMap[e.avaliado_id] = e; });

      setJogadores(uids.map((uid) => {
        const ex = existentesMap[uid];
        const exGk = skillGoleiroMap[uid];
        return {
          user_id: uid,
          nome: pMap[uid] || "Jogador",
          time_nome: userTime[uid],
          eh_goleiro: !!goleiroMap[uid],
          ehConvidado: !!convidadosMap[uid],
          gols: ex ? ex.gols_confirmados : (stats[uid]?.g || 0),
          passes: ex ? ex.passes_confirmados : (stats[uid]?.p || 0),
          defesas: ex ? ex.defesas_confirmadas : (stats[uid]?.d || 0),
          // padrão neutro (3) — o slider precisa de um valor válido; a trava de
          // "ainda não avaliei" agora é controlada por `tocados`, não pelo valor
          nota_geral: ex?.nota_geral || 3,
          nota_comportamento: ex?.nota_comportamento || 3,
          desempenho: skillMap[uid]?.nota_desempenho_geral || 3,
          reflexo: exGk?.reflexo || 3,
          seguranca: exGk?.seguranca || 3,
          jogo_aereo: exGk?.jogo_aereo || 3,
          saida_pes: exGk?.saida_pes || 3,
          posicionamento_gk: exGk?.posicionamento || 3,
          comando_area: exGk?.comando_area || 3,
        };
      }));

      // jogadores já avaliados em uma sessão anterior entram direto travados,
      // sem disparar de novo o modal de bônus (isso só acontece na transição ao vivo)
      const jaConfirmados: Record<string, { xp?: number }> = {};
      const ordemInicial: string[] = [];
      uids.forEach((uid) => {
        if (existentesMap[uid]) { jaConfirmados[uid] = {}; ordemInicial.push(uid); }
      });
      setConfirmados(jaConfirmados);
      setOrdemConfirmacao(ordemInicial);

      setLoading(false);
    })();
  }, [id, user?.id]);

  const upd = (uid: string, patch: Partial<Ja>) =>
    setJogadores((arr) => arr.map((j) => j.user_id === uid ? { ...j, ...patch } : j));

  const buscarXpCreditado = async (acao: string) => {
    if (!user) return 0;
    const { data } = await supabase
      .from("pontos_historico")
      .select("valor_pontos")
      .eq("user_id", user.id)
      .eq("pelada_id", id)
      .eq("acao", acao)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as any)?.valor_pontos ?? 0;
  };

  const confirmarJogador = async (uid: string) => {
    if (!user || !pelada) return;
    const j = jogadores.find((x) => x.user_id === uid);
    if (!j) return;
    if (!foiTocado(uid, "nota_geral") || !foiTocado(uid, "nota_comportamento")) {
      toast.error("Avalie nota geral e comportamento antes de confirmar.");
      return;
    }
    if (j.eh_goleiro) {
      const camposGoleiro = ["reflexo", "seguranca", "jogo_aereo", "saida_pes", "posicionamento_gk", "comando_area"];
      if (camposGoleiro.some((c) => !foiTocado(uid, c))) {
        toast.error("Avalie todas as 6 skills de goleiro antes de confirmar.");
        return;
      }
    } else if (!foiTocado(uid, "desempenho")) {
      toast.error("Avalie o desempenho antes de confirmar.");
      return;
    }
    setConfirmando((m) => ({ ...m, [uid]: true }));

    const { error: e1 } = await supabase.from("avaliacoes_pos_pelada").insert({
      pelada_id: id, avaliador_id: user.id, avaliado_id: uid,
      gols_confirmados: j.gols, passes_confirmados: j.passes, defesas_confirmadas: j.defesas,
      nota_geral: j.nota_geral, nota_comportamento: j.nota_comportamento,
    } as never);
    if (e1) {
      toast.error(e1.message);
      setConfirmando((m) => ({ ...m, [uid]: false }));
      return;
    }

    if (j.ehConvidado) {
      // "Convidado" não tem conta — não existe skills dele pra atualizar (seria
      // um insert perdido, sem efeito nenhum). Em vez disso, guardamos a nota
      // e atualizamos o nível dele nessa mesma pelada com a média de quem avaliou.
      const notaRepresentativa = j.eh_goleiro
        ? Math.round((j.reflexo + j.seguranca + j.jogo_aereo + j.saida_pes + j.posicionamento_gk + j.comando_area) / 6)
        : j.desempenho;
      const { error: e2 } = await (supabase as any).from("avaliacoes_skill_membro").insert({
        avaliador_id: user.id, avaliado_id: uid, grupo_id: pelada.grupo_id,
        tipo: "pos_pelada", pelada_id: id, conhece_jogador: true,
        nota_desempenho_geral: notaRepresentativa,
      });
      if (e2) toast.error(e2.message);
      else {
        const { data: notas } = await (supabase as any)
          .from("avaliacoes_skill_membro")
          .select("nota_desempenho_geral")
          .eq("avaliado_id", uid).eq("pelada_id", id).eq("tipo", "pos_pelada");
        if (notas?.length) {
          const media = Math.round(notas.reduce((a: number, n: any) => a + (n.nota_desempenho_geral || 0), 0) / notas.length);
          await supabase.from("pelada_convidados").update({ nivel_geral: media } as never).eq("id", uid);
        }
      }
    } else if (j.eh_goleiro) {
      const { error: e2 } = await (supabase as any).from("avaliacoes_goleiro_pos_pelada").insert({
        avaliador_id: user.id, avaliado_id: uid, pelada_id: id,
        reflexo: j.reflexo, seguranca: j.seguranca, jogo_aereo: j.jogo_aereo,
        saida_pes: j.saida_pes, posicionamento: j.posicionamento_gk, comando_area: j.comando_area,
      });
      if (e2) toast.error(e2.message);
    } else if (pelada.grupo_id) {
      const { error: e2 } = await (supabase as any).from("avaliacoes_skill_membro").insert({
        avaliador_id: user.id, avaliado_id: uid, grupo_id: pelada.grupo_id,
        tipo: "pos_pelada", pelada_id: id, conhece_jogador: true,
        nota_desempenho_geral: j.desempenho,
      });
      if (e2) toast.error(e2.message);
    }

    const xpGanho = await buscarXpCreditado("avaliou_pos_pelada");
    xpSessaoRef.current += xpGanho;

    setConfirmados((m) => ({ ...m, [uid]: { xp: xpGanho } }));
    setOrdemConfirmacao((ord) => [...ord, uid]);
    toast.success(`${j.nome} avaliado! ${xpGanho > 0 ? `+${xpGanho} XP` : ""}`);
    setConfirmando((m) => ({ ...m, [uid]: false }));

    const totalConfirmadosAgora = ordemConfirmacao.length + 1;
    if (totalConfirmadosAgora === jogadores.length && jogadores.length > 0) {
      const bonus = await buscarXpCreditado("avaliou_jogadores");
      setXpModal({ bonus, totalSessao: xpSessaoRef.current });
    }
  };

  const enviarVotos = async () => {
    if (!user) return;
    setSaving(true);
    if (mvp) {
      const { error: e2 } = await supabase
        .from("mvp_votos")
        .upsert({ pelada_id: id, votante_id: user.id, votado_id: mvp } as never, { onConflict: "pelada_id,votante_id" });
      if (e2) toast.error(e2.message);
    }
    const votosRows = Object.entries(votosResenha)
      .filter(([, votado_id]) => !!votado_id)
      .map(([categoria, votado_id]) => ({ pelada_id: id, categoria, votante_id: user.id, votado_id }));
    if (votosRows.length) {
      const { error: e3 } = await (supabase as any)
        .from("resenha_votos")
        .upsert(votosRows, { onConflict: "pelada_id,categoria,votante_id" });
      if (e3) toast.error(e3.message);
    }
    toast.success("Votos enviados!");
    setJaEnviouVotos(true);
    setSaving(false);
    navigate({ to: "/jogador/peladas" });
  };

  const jogadoresOrdenados = useMemo(() => {
    const pendentes = jogadores.filter((j) => !confirmados[j.user_id]);
    const feitos = ordemConfirmacao
      .map((uid) => jogadores.find((j) => j.user_id === uid))
      .filter(Boolean) as Ja[];
    return [...pendentes, ...feitos];
  }, [jogadores, confirmados, ordemConfirmacao]);

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!pelada?.avaliacao_aberta) return <div className="text-sm text-muted-foreground">A janela de avaliação está fechada.</div>;
  if (!jogadores.length) return <div className="text-sm text-muted-foreground">Nenhum jogador para avaliar.</div>;

  const avaliados = Object.keys(confirmados).length;
  const total = jogadores.length;
  const completo = avaliados === total && total > 0;

  return (
    <div className="space-y-4">
      <button onClick={() => navigate({ to: "/peladas/$id", params: { id } })} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h2 className="text-xl font-bold">Avaliar pelada</h2>
      <p className="text-xs text-muted-foreground">Avaliações são anônimas. Confirme cada jogador pra garantir seu XP.</p>

      {jaEnviouVotos && (
        <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-sm font-semibold text-green-500">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Você já votou em MVP/Resenha nessa pelada. Pode alterar seu voto se quiser.
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex justify-between text-xs mb-1">
          <span>Avaliando {avaliados} de {total} jogadores</span>
          <span className="font-bold text-primary">{Math.round((avaliados / Math.max(total,1)) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all" style={{ width: `${(avaliados / Math.max(total,1)) * 100}%` }} />
        </div>
        {completo && (
          <div className="mt-2 rounded-lg bg-green-500/15 px-3 py-2 text-xs font-bold text-green-500">
            🏆 Avaliação completa! Você já garantiu o bônus de XP.
          </div>
        )}
      </div>

      {jogadoresOrdenados.map((j) => {
        const confirmado = !!confirmados[j.user_id];
        const xpDoJogador = confirmados[j.user_id]?.xp;
        return (
          <div
            key={j.user_id}
            className={`rounded-2xl border p-4 space-y-3 transition-opacity ${confirmado ? "opacity-50 border-border bg-card/60" : "border-border bg-card"}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  {j.eh_goleiro && <span title="Jogou de goleiro">🧤</span>}
                  {j.ehConvidado && (
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground" title="Jogador avulso, sem conta no app">
                      Convidado
                    </span>
                  )}
                  {j.nome}
                  {confirmado && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                {j.time_nome && <div className="text-xs text-muted-foreground">{j.time_nome}</div>}
              </div>
              {confirmado && (
                <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-1 text-[11px] font-bold text-green-500">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {typeof xpDoJogador === "number" && xpDoJogador > 0 ? `+${xpDoJogador} XP` : "Avaliado"}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              {(["gols", "passes", "defesas"] as const).map((k) => (
                <label key={k} className="flex flex-col gap-1">
                  <span className="text-xs uppercase text-muted-foreground">{k}</span>
                  <input type="number" min={0} value={(j as any)[k]} disabled={confirmado}
                    onChange={(e) => upd(j.user_id, { [k]: Math.max(0, parseInt(e.target.value || "0", 10)) } as any)}
                    className="rounded-lg bg-secondary px-2 py-1 outline-none disabled:cursor-not-allowed" />
                </label>
              ))}
            </div>

            <SliderRating
              label="Nota geral"
              caption="Como ele jogou no geral: participação, contribuição em ataque e defesa"
              value={j.nota_geral}
              tocado={foiTocado(j.user_id, "nota_geral")}
              disabled={confirmado}
              onChange={(v) => { upd(j.user_id, { nota_geral: v }); marcarTocado(j.user_id, "nota_geral"); }}
            />
            <SliderRating
              label="Comportamento"
              caption="Fair play: educação e postura com os colegas em quadra"
              value={j.nota_comportamento}
              tocado={foiTocado(j.user_id, "nota_comportamento")}
              disabled={confirmado}
              onChange={(v) => { upd(j.user_id, { nota_comportamento: v }); marcarTocado(j.user_id, "nota_comportamento"); }}
            />

            {j.eh_goleiro ? (
              <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-3">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">🧤 Avaliação de goleiro</div>
                {SKILLS_GOLEIRO.map((sk) => (
                  <SliderRating
                    key={sk.key}
                    label={sk.label}
                    caption={sk.caption}
                    value={(j as any)[sk.key]}
                    tocado={foiTocado(j.user_id, sk.key)}
                    disabled={confirmado}
                    onChange={(v) => { upd(j.user_id, { [sk.key]: v } as any); marcarTocado(j.user_id, sk.key); }}
                  />
                ))}
              </div>
            ) : (
              <SliderRating
                label="Desempenho na pelada"
                caption={foiTocado(j.user_id, "desempenho") ? DESEMPENHO_LABELS[Math.round(j.desempenho)] : undefined}
                value={j.desempenho}
                tocado={foiTocado(j.user_id, "desempenho")}
                disabled={confirmado}
                onChange={(v) => { upd(j.user_id, { desempenho: v }); marcarTocado(j.user_id, "desempenho"); }}
              />
            )}

            {!confirmado && (
              <Button
                onClick={() => confirmarJogador(j.user_id)}
                disabled={
                  !!confirmando[j.user_id] || !foiTocado(j.user_id, "nota_geral") || !foiTocado(j.user_id, "nota_comportamento") ||
                  (j.eh_goleiro
                    ? ["reflexo", "seguranca", "jogo_aereo", "saida_pes", "posicionamento_gk", "comando_area"].some((c) => !foiTocado(j.user_id, c))
                    : !foiTocado(j.user_id, "desempenho"))
                }
                className="w-full bg-primary font-bold"
              >
                {confirmando[j.user_id] ? "Confirmando..." : "Confirmar avaliação"}
              </Button>
            )}
          </div>
        );
      })}

      <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <div className="font-bold">⭐ Quem foi o MVP?</div>
        <div className="grid gap-2">
          {jogadores.map((j) => (
            <label key={j.user_id} className="flex items-center gap-2 text-sm">
              <input type="radio" name="mvp" checked={mvp === j.user_id} onChange={() => setMvp(j.user_id)} />
              {j.nome}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div>
          <div className="font-bold">🎉 Resenha da pelada</div>
          <p className="text-xs text-muted-foreground">100% anônimo — nem o capitão vê quem votou em quem. Pode deixar em branco qualquer categoria.</p>
        </div>
        {CATEGORIAS_RESENHA.map((cat) => (
          <div key={cat.v}>
            <div className="mb-1.5 text-sm font-bold">{cat.emoji} {cat.label}</div>
            <div className="grid grid-cols-2 gap-2">
              {jogadores.map((j) => (
                <button
                  key={j.user_id}
                  type="button"
                  onClick={() => setVotosResenha((v) => ({ ...v, [cat.v]: v[cat.v] === j.user_id ? "" : j.user_id }))}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${votosResenha[cat.v] === j.user_id ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30"}`}
                >
                  {j.nome}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Button onClick={enviarVotos} disabled={saving} className="w-full bg-primary font-bold">
        {saving ? "Enviando..." : jaEnviouVotos ? "Atualizar votos de MVP e Resenha" : "Enviar votos de MVP e Resenha"}
      </Button>

      {xpModal && (
        <XpBonusModal
          bonus={xpModal.bonus}
          totalSessao={xpModal.totalSessao}
          onClose={() => setXpModal(null)}
        />
      )}
    </div>
  );
}

function SliderRating({ label, caption, value, tocado, onChange, disabled }: {
  label: string; caption?: string; value: number; tocado: boolean; onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${tocado ? "text-primary" : "text-muted-foreground/50"}`}>
          {tocado ? value.toFixed(1) : "— avalie"}
        </span>
      </div>
      {caption && <div className="text-[10.5px] text-muted-foreground/70 mb-1">{caption}</div>}
      <div className={`py-1.5 transition-opacity ${tocado ? "" : "opacity-60"}`}>
        <Slider
          min={1} max={5} step={0.5}
          value={[value]}
          disabled={disabled}
          onValueChange={([v]) => onChange(v)}
        />
      </div>
    </div>
  );
}

function animarNumero(de: number, para: number, duracaoMs: number, onUpdate: (v: number) => void, onFim?: () => void) {
  const inicio = performance.now();
  let frame: number;
  const passo = (agora: number) => {
    const progresso = Math.min(1, (agora - inicio) / duracaoMs);
    const facil = 1 - Math.pow(1 - progresso, 3); // ease-out
    onUpdate(Math.round(de + (para - de) * facil));
    if (progresso < 1) frame = requestAnimationFrame(passo);
    else onFim?.();
  };
  frame = requestAnimationFrame(passo);
  return () => cancelAnimationFrame(frame);
}

function dispararConfete() {
  const cores = ["#00FF87", "#FFD500", "#FF7A00", "#FFFFFF"];
  confetti({ particleCount: 90, spread: 100, startVelocity: 45, origin: { y: 0.35 }, colors: cores, zIndex: 9999 });
  confetti({ particleCount: 40, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors: cores, zIndex: 9999 });
  confetti({ particleCount: 40, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors: cores, zIndex: 9999 });
}

function XpBonusModal({ bonus, totalSessao, onClose }: { bonus: number; totalSessao: number; onClose: () => void }) {
  const base = Math.max(0, totalSessao);
  const temBonus = bonus > 0;
  const alvoFinal = base + Math.max(0, bonus);

  const [contador, setContador] = useState(0);
  const [fase, setFase] = useState<"contando_base" | "explosao" | "contando_bonus" | "fim">("contando_base");
  const [explodindo, setExplodindo] = useState(false);
  const [bonusRevelado, setBonusRevelado] = useState(false);

  useEffect(() => {
    let cancelarAtual = () => {};
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    if (base <= 0 && !temBonus) {
      setContador(0);
      setFase("fim");
      dispararConfete();
      return;
    }

    // FASE 1 — conta do zero até o XP normal ganho nas avaliações
    cancelarAtual = animarNumero(0, base, base > 0 ? 900 : 1, setContador, () => {
      if (!temBonus) {
        setFase("fim");
        dispararConfete();
        return;
      }
      // FASE 2 — explosão: confete + pulso + muda de cor + revela o bônus
      timeouts.push(setTimeout(() => {
        setFase("explosao");
        setExplodindo(true);
        setBonusRevelado(true);
        dispararConfete();
        timeouts.push(setTimeout(() => setExplodindo(false), 350));
        // FASE 3 — continua contando até o total (base + bônus)
        timeouts.push(setTimeout(() => {
          setFase("contando_bonus");
          cancelarAtual = animarNumero(base, alvoFinal, 900, setContador, () => setFase("fim"));
        }, 300));
      }, 250));
    });

    return () => {
      cancelarAtual();
      timeouts.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const corNumero = fase === "explosao" || fase === "contando_bonus" || (fase === "fim" && temBonus) ? "#FFD500" : "#00FF87";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-6" onClick={fase === "fim" ? onClose : undefined}>
      <div
        className={`w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl transition-transform duration-300 ${explodindo ? "scale-110" : "scale-100"}`}
        style={{
          borderColor: temBonus && (fase === "explosao" || fase === "contando_bonus" || fase === "fim") ? "rgba(255,213,0,0.4)" : "rgba(0,255,135,0.3)",
          background: "#151515",
          boxShadow: fase === "fim" || fase === "contando_bonus" || fase === "explosao"
            ? "0 0 80px rgba(255,213,0,0.35)"
            : "0 0 60px rgba(0,255,135,0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-300`}
          style={{ background: corNumero === "#FFD500" ? "rgba(255,213,0,0.15)" : "rgba(0,255,135,0.15)" }}
        >
          <PartyPopper className="h-8 w-8" style={{ color: corNumero }} />
        </div>

        <h3 className="text-lg font-bold">
          {fase === "contando_base" && "Mandou muito bem! 🔥"}
          {fase === "explosao" && "BÔNUS DESBLOQUEADO! 🎉"}
          {fase === "contando_bonus" && "BÔNUS DESBLOQUEADO! 🎉"}
          {fase === "fim" && (temBonus ? "UAU! Avaliação completa! 🏆" : "Avaliação registrada!")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {fase === "contando_base" && "Contando o XP que você ganhou avaliando a galera..."}
          {(fase === "explosao" || fase === "contando_bonus") && "Você avaliou todo mundo — bônus liberado!"}
          {fase === "fim" && (temBonus ? "Você avaliou todo mundo e faturou um bônus surpresa." : "Seu XP já caiu na conta.")}
        </p>

        <div
          className={`my-5 font-black tabular-nums transition-all duration-300 ${explodindo ? "text-6xl" : "text-5xl"}`}
          style={{ color: corNumero, textShadow: fase !== "contando_base" ? `0 0 24px ${corNumero}66` : "none" }}
        >
          +{contador} XP
        </div>

        {bonusRevelado && (
          <p className="mb-2 text-xs font-bold" style={{ color: "#FFD500" }}>
            + {bonus} XP de bônus por avaliar todo mundo
          </p>
        )}

        {fase === "fim" && (
          <p className="text-xs text-muted-foreground">
            Continue avaliando toda pelada — quanto mais você participa, mais XP entra. 💪
          </p>
        )}

        {fase === "fim" && (
          <Button onClick={onClose} className="mt-5 w-full font-bold" style={{ background: corNumero, color: "#0D0D0D" }}>
            Show de bola!
          </Button>
        )}
      </div>
    </div>
  );
}
