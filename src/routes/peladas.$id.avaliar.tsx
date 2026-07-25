import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { Star, ArrowLeft, CheckCircle2, Lock, PartyPopper } from "lucide-react";
import { toast } from "sonner";

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
  gols: number; passes: number; defesas: number;
  nota_geral: number; nota_comportamento: number;
  desempenho: number;
};

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

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
      setPelada(p);
      const { data: tj } = await supabase.from("time_jogadores").select("user_id,time_id").eq("pelada_id", id);
      const uids = Array.from(new Set((tj || []).map((x: any) => x.user_id))).filter((u) => u !== user.id);
      const timeIds = Array.from(new Set((tj || []).map((x: any) => x.time_id)));
      const [{ data: profs }, { data: times }, { data: lances }, { data: existentes }, { data: existentesSkill }, { data: mvpExistente }, { data: resenhaExistente }] = await Promise.all([
        supabase.from("profiles").select("user_id,nome").in("user_id", uids.length ? uids : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("times").select("id,nome").in("id", timeIds.length ? timeIds : ["00000000-0000-0000-0000-000000000000"]),
        supabase.from("lances").select("user_id,tipo").eq("pelada_id", id),
        supabase.from("avaliacoes_pos_pelada").select("avaliado_id,nota_geral,nota_comportamento,gols_confirmados,passes_confirmados,defesas_confirmadas").eq("pelada_id", id).eq("avaliador_id", user.id),
        (supabase as any).from("avaliacoes_skill_membro").select("avaliado_id,nota_desempenho_geral").eq("pelada_id", id).eq("avaliador_id", user.id).eq("tipo", "pos_pelada"),
        supabase.from("mvp_votos").select("votado_id").eq("pelada_id", id).eq("votante_id", user.id).maybeSingle(),
        (supabase as any).from("resenha_votos").select("categoria,votado_id").eq("pelada_id", id).eq("votante_id", user.id),
      ]);
      if (mvpExistente) setMvp((mvpExistente as any).votado_id);
      if (resenhaExistente?.length) {
        const rMap: Record<string, string> = {};
        (resenhaExistente as any[]).forEach((r) => { rMap[r.categoria] = r.votado_id; });
        setVotosResenha(rMap);
      }
      const pMap: Record<string, string> = {};
      (profs || []).forEach((p: any) => { pMap[p.user_id] = p.nome; });
      const tMap: Record<string, string> = {};
      (times || []).forEach((t: any) => { tMap[t.id] = t.nome; });
      const userTime: Record<string, string> = {};
      (tj || []).forEach((x: any) => { userTime[x.user_id] = tMap[x.time_id] || ""; });
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

      setJogadores(uids.map((uid) => {
        const ex = existentesMap[uid];
        return {
          user_id: uid,
          nome: pMap[uid] || "Jogador",
          time_nome: userTime[uid],
          gols: ex ? ex.gols_confirmados : (stats[uid]?.g || 0),
          passes: ex ? ex.passes_confirmados : (stats[uid]?.p || 0),
          defesas: ex ? ex.defesas_confirmadas : (stats[uid]?.d || 0),
          // zeradas por padrão — ninguém pode confirmar sem escolher de verdade
          nota_geral: ex?.nota_geral || 0,
          nota_comportamento: ex?.nota_comportamento || 0,
          desempenho: skillMap[uid]?.nota_desempenho_geral || 0,
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
    if (j.nota_geral < 1 || j.nota_comportamento < 1 || j.desempenho < 1) {
      toast.error("Dê pelo menos 1 estrela em cada categoria antes de confirmar.");
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

    if (pelada.grupo_id) {
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

            <Stars
              label="Nota geral"
              caption="Como ele jogou no geral: participação, contribuição em ataque e defesa"
              value={j.nota_geral}
              disabled={confirmado}
              onChange={(v) => upd(j.user_id, { nota_geral: v })}
            />
            <Stars
              label="Comportamento"
              caption="Fair play: educação e postura com os colegas em quadra"
              value={j.nota_comportamento}
              disabled={confirmado}
              onChange={(v) => upd(j.user_id, { nota_comportamento: v })}
            />
            <div>
              <div className="text-xs text-muted-foreground">Desempenho na pelada</div>
              <div className="flex gap-1">
                {[1,2,3,4,5].map((n) => (
                  <button key={n} type="button" disabled={confirmado} onClick={() => upd(j.user_id, { desempenho: n })} className="disabled:cursor-not-allowed">
                    <Star className={`h-6 w-6 ${n <= j.desempenho ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              {j.desempenho > 0 && <div className="text-[11px] text-muted-foreground mt-1">{DESEMPENHO_LABELS[j.desempenho]}</div>}
            </div>

            {!confirmado && (
              <Button
                onClick={() => confirmarJogador(j.user_id)}
                disabled={!!confirmando[j.user_id] || j.nota_geral < 1 || j.nota_comportamento < 1 || j.desempenho < 1}
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
        Enviar votos de MVP e Resenha
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

function Stars({ label, caption, value, onChange, disabled }: { label: string; caption?: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {caption && <div className="text-[10.5px] text-muted-foreground/70 mb-0.5">{caption}</div>}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => onChange(n)} type="button" disabled={disabled} className="disabled:cursor-not-allowed">
            <Star className={`h-6 w-6 ${n <= value ? "fill-primary text-primary" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function XpBonusModal({ bonus, totalSessao, onClose }: { bonus: number; totalSessao: number; onClose: () => void }) {
  const [contador, setContador] = useState(0);
  const alvo = bonus > 0 ? bonus : totalSessao;

  useEffect(() => {
    if (alvo <= 0) { setContador(0); return; }
    const duracaoMs = 1200;
    const inicio = performance.now();
    let frame: number;
    const passo = (agora: number) => {
      const progresso = Math.min(1, (agora - inicio) / duracaoMs);
      const valorAtual = Math.round(alvo * (1 - Math.pow(1 - progresso, 3))); // ease-out
      setContador(valorAtual);
      if (progresso < 1) frame = requestAnimationFrame(passo);
    };
    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [alvo]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-3xl border border-primary/30 bg-card p-6 text-center shadow-2xl"
        style={{ boxShadow: "0 0 60px rgba(0,255,135,0.25)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
          <PartyPopper className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-bold">Avaliação completa!</h3>
        <p className="mt-1 text-xs text-muted-foreground">Você avaliou todo mundo e ganhou um bônus de XP</p>
        <div className="my-5 text-5xl font-black tabular-nums text-primary">+{contador}</div>
        {bonus > 0 && totalSessao > bonus && (
          <p className="text-xs text-muted-foreground">
            Somando o XP de cada avaliação, você faturou <span className="font-bold text-foreground">{totalSessao} XP</span> nessa rodada.
          </p>
        )}
        <Button onClick={onClose} className="mt-5 w-full bg-primary font-bold">
          Show de bola!
        </Button>
      </div>
    </div>
  );
}
