import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { ArrowLeft, Shuffle, CircleDot, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getNavItems } from "@/lib/navItems";
import { CORES_TIMES, type Jogador, mediaSkill, mediaTime, sortear, sortearPorPote } from "@/lib/sorteio";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useConfirm } from "@/components/ConfirmProvider";

export const Route = createFileRoute("/peladas/$id/sorteio")({
  component: Wrapper,
});

function Wrapper() {
  const { user } = useAuth();
  return (
    <RequireAuth allow={["capitao", "admin"]}>
      <MobileShell items={getNavItems(user?.role)}><SorteioPage /></MobileShell>
    </RequireAuth>
  );
}

type TimeUI = { nome: string; cor: string; jogadores: Jogador[]; goleiros: Jogador[] };
type JogadorSorteio = Jogador & { skills_pendentes?: boolean; convidado?: boolean };

function SorteioPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [pelada, setPelada] = useState<any>(null);
  const [confirmados, setConfirmados] = useState<JogadorSorteio[]>([]);
  const [times, setTimes] = useState<TimeUI[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmacaoOpen, setConfirmacaoOpen] = useState(false);
  const [modo, setModo] = useState<"avaliacao" | "pote">("avaliacao");
  const [incluirGoleirosPote, setIncluirGoleirosPote] = useState(false);
  const [potes, setPotes] = useState<Record<string, number>>({});

  const load = async () => {
    setLoading(true);
    const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
    setPelada(p);
    if (!p) { setLoading(false); return; }

    const { data: confs } = await supabase
      .from("pelada_confirmacoes").select("*").eq("pelada_id", id).eq("status", "confirmado");
    const userIds = (confs || []).map((c: any) => c.user_id);
    const [{ data: profs }, { data: skills }, { data: convitesAceitos }] = await Promise.all([
      supabase.from("profiles").select("user_id, nome, posicao_preferida, quer_ser_goleiro").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("skills").select("*").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
      (supabase as any).from("goleiros_convites").select("goleiro_id, goleiros_perfil!inner(user_id)").eq("pelada_id", id).eq("status", "aceito"),
    ]);
    const profMap = new Map((profs || []).map((x: any) => [x.user_id, x]));
    const skMap = new Map((skills || []).map((x: any) => [x.user_id, x]));
    const contratadosIds = new Set((convitesAceitos || []).map((c: any) => c.goleiros_perfil?.user_id).filter(Boolean));

    // pra goleiro (contratado ou não), o nível usado no sorteio vem das skills
    // específicas de goleiro (reflexo/segurança/etc.), não das skills de linha —
    // reflete melhor a habilidade real dele naquela função.
    const goleiroIds = userIds.filter((uid) => {
      const prof: any = profMap.get(uid) || {};
      return !!prof.quer_ser_goleiro || prof.posicao_preferida === "goleiro" || contratadosIds.has(uid);
    });
    const { data: skillsGoleiro } = goleiroIds.length
      ? await (supabase as any).from("skills_goleiro").select("*").in("user_id", goleiroIds)
      : { data: [] as any[] };
    const skGoleiroMap = new Map((skillsGoleiro || []).map((x: any) => [x.user_id, x]));
    const mediaGoleiro = (sk: any) => {
      if (!sk) return 3.0;
      const vals = [sk.reflexo, sk.seguranca, sk.jogo_aereo, sk.saida_pes, sk.posicionamento, sk.comando_area];
      return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
    };

    const list: JogadorSorteio[] = (confs || []).map((c: any) => {
      const prof: any = profMap.get(c.user_id) || {};
      const ehGk = !!c.eh_goleiro || prof.posicao_preferida === "goleiro" || !!prof.quer_ser_goleiro || contratadosIds.has(c.user_id);
      const contratado = contratadosIds.has(c.user_id);
      const skGk = skGoleiroMap.get(c.user_id);
      const skLinha = skMap.get(c.user_id);
      const pendente = ehGk ? !skGk : (!skLinha || !skLinha.origem_ultima_atualizacao);
      return {
        user_id: c.user_id,
        nome: contratado ? `${prof.nome || "Jogador"} (contratado)` : (prof.nome || "Jogador"),
        media: ehGk ? mediaGoleiro(skGk) : (pendente ? 3.0 : mediaSkill(skLinha as any)),
        eh_goleiro: ehGk,
        contratado,
        skills_pendentes: pendente,
      };
    });

    const { data: convs } = await supabase.from("pelada_convidados").select("*").eq("pelada_id", id);
    const listaConvidados: JogadorSorteio[] = (convs || []).map((c: any) => ({
      user_id: c.id,
      nome: `${c.nome} (convidado)`,
      media: c.nivel_geral || 5.5,
      eh_goleiro: c.posicao === "goleiro",
      convidado: true,
    }));

    setConfirmados([...list, ...listaConvidados]);
    const todosCandidatos = [...list, ...listaConvidados];

    // se já existe sorteio, carrega
    const { data: tms } = await supabase.from("times").select("*").eq("pelada_id", id).order("ordem");
    if (tms && tms.length) {
      const { data: tj } = await supabase.from("time_jogadores").select("*").eq("pelada_id", id);
      const ui: TimeUI[] = tms.map((t: any) => {
        const membros = (tj || []).filter((x: any) => x.time_id === t.id);
        const toJ = (m: any): Jogador => {
          const fonte = todosCandidatos.find((l) => l.user_id === m.user_id);
          return fonte || { user_id: m.user_id, nome: profMap.get(m.user_id)?.nome || "Jogador", media: mediaSkill(skMap.get(m.user_id) as any), eh_goleiro: m.eh_goleiro };
        };
        return {
          nome: t.nome, cor: t.cor,
          jogadores: membros.filter((m: any) => !m.eh_goleiro).map(toJ),
          goleiros: membros.filter((m: any) => m.eh_goleiro).map(toJ),
        };
      });
      setTimes(ui);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);

  const totalLinha = confirmados.filter((c) => !c.eh_goleiro).length;
  const totalGoleirosDisp = confirmados.filter((c) => c.eh_goleiro).length;

  // O número de times é sempre o configurado na criação da pelada — não recalculamos isso.
  // O que muda dinamicamente é só a distribuição de jogadores/goleiros dentro desses times.
  const numTimes = pelada ? pelada.numero_times : 2;
  const linhaPorTimeAprox = numTimes ? Math.floor(totalLinha / numTimes) : 0;
  const linhaComSobra = numTimes ? totalLinha % numTimes : 0;

  const minimoOk = useMemo(() => {
    if (!pelada) return false;
    return totalLinha >= pelada.numero_times * 2;
  }, [pelada, totalLinha]);

  const totalGoleirosNecessarios = pelada ? pelada.goleiros_por_time * pelada.numero_times : 0;
  const totalGoleirosConfirmados = totalGoleirosDisp;

  const pendentes = (confirmados as any[]).filter((c) => c.skills_pendentes);

  // ============ sorteio por pote ============
  const numPotes = pelada ? pelada.jogadores_por_time : 0;
  const jogadoresParaPote = confirmados.filter((c) => incluirGoleirosPote || !c.eh_goleiro);
  const goleirosForaDoPote = confirmados.filter((c) => c.eh_goleiro && !incluirGoleirosPote);

  const contagemPorPote = useMemo(() => {
    const contagem: Record<number, number> = {};
    for (let p = 1; p <= numPotes; p++) contagem[p] = 0;
    jogadoresParaPote.forEach((j) => {
      const p = potes[j.user_id];
      if (p) contagem[p] = (contagem[p] || 0) + 1;
    });
    return contagem;
  }, [potes, jogadoresParaPote, numPotes]);

  const semPote = jogadoresParaPote.filter((j) => !potes[j.user_id]);
  const potesCompletos = numTimes > 0 && numPotes > 0 && semPote.length === 0 &&
    Array.from({ length: numPotes }, (_, i) => i + 1).every((p) => contagemPorPote[p] === numTimes);

  const gerarPorPoteInterno = () => {
    if (!pelada || !potesCompletos) return;
    const jogadoresPorPote: Record<number, Jogador[]> = {};
    for (let p = 1; p <= numPotes; p++) {
      jogadoresPorPote[p] = jogadoresParaPote.filter((j) => potes[j.user_id] === p);
    }
    const { jogadores, goleiros } = sortearPorPote(jogadoresPorPote, numTimes, goleirosForaDoPote);
    const cores = CORES_TIMES[numTimes] || [];
    const ui: TimeUI[] = Array.from({ length: numTimes }, (_, i) => ({
      nome: times[i]?.nome || cores[i]?.nome || `Time ${i + 1}`,
      cor: times[i]?.cor || cores[i]?.cor || "#666666",
      jogadores: jogadores[i] || [],
      goleiros: goleiros[i] || [],
    }));
    setTimes(ui);
  };

  const gerarInterno = () => {
    if (!pelada) return;
    const modalidade = ((pelada as any).modalidade_goleiro || "fixo") as "fixo" | "sorteado";
    const { jogadores, goleiros } = sortear(confirmados, numTimes, modalidade);
    const cores = CORES_TIMES[numTimes] || [];
    const ui: TimeUI[] = Array.from({ length: numTimes }, (_, i) => ({
      nome: times[i]?.nome || cores[i]?.nome || `Time ${i + 1}`,
      cor: times[i]?.cor || cores[i]?.cor || "#666666",
      jogadores: jogadores[i] || [],
      goleiros: goleiros[i] || [],
    }));
    setTimes(ui);
  };

  const gerar = async () => {
    if (!pelada) return;
    if (modo === "pote") {
      if (times.length === 0) { setConfirmacaoOpen(true); return; }
      gerarPorPoteInterno();
      return;
    }
    if (pendentes.length > 0) {
      const nomes = pendentes.map((p) => p.nome).join(", ");
      if (!(await confirm({
        title: "Jogadores sem skills",
        description: `⚠️ ${pendentes.length} jogador(es) ainda não têm skills definidas: ${nomes}.\n\nO sorteio será menos preciso (média neutra 5.5). Continuar mesmo assim?`,
        confirmLabel: "Continuar mesmo assim",
      }))) return;
    }
    if (times.length === 0) { setConfirmacaoOpen(true); return; }
    gerarInterno();
  };

  const confirmar = async () => {
    if (!user || !pelada || !times.length) return;
    setSaving(true);
    // limpa anteriores
    await supabase.from("time_jogadores").delete().eq("pelada_id", id);
    await supabase.from("times").delete().eq("pelada_id", id);

    for (let i = 0; i < times.length; i++) {
      const t = times[i];
      const { data: novo, error } = await supabase.from("times")
        .insert({ pelada_id: id, nome: t.nome, cor: t.cor, ordem: i } as never)
        .select().single();
      if (error || !novo) { toast.error(error?.message || "Erro ao salvar time"); setSaving(false); return; }
      const rows = [
        ...t.jogadores.map((j) => ({ time_id: (novo as any).id, pelada_id: id, user_id: j.user_id, eh_goleiro: false })),
        ...t.goleiros.map((j) => ({ time_id: (novo as any).id, pelada_id: id, user_id: j.user_id, eh_goleiro: true })),
      ];
      if (rows.length) {
        const { error: e2 } = await supabase.from("time_jogadores").insert(rows as never);
        if (e2) { toast.error(e2.message); setSaving(false); return; }
      }
    }

    await supabase.from("peladas").update({ sorteio_feito: true, status: "confirmada" } as never).eq("id", id);
    await supabase.from("sorteio_log").insert({ pelada_id: id, realizado_por: user.id, tipo: "primeiro_sorteio" } as never);

    // notificações
    const notifs = times.flatMap((t) => {
      const membros = [...t.jogadores, ...t.goleiros];
      const nomes = membros.map((m) => m.nome).join(", ");
      return membros
        .filter((m: any) => !m.convidado)
        .map((m) => ({
          user_id: m.user_id,
          titulo: "⚽ Times sorteados!",
          mensagem: `Você está no ${t.nome}. Companheiros: ${nomes}. Bora!`,
          link: `/peladas/${id}`,
        }));
    });
    if (notifs.length) await supabase.from("notificacoes").insert(notifs as never);

    setSaving(false);
    toast.success("Sorteio confirmado!");
    navigate({ to: "/peladas/$id", params: { id } });
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!pelada) return <EmptyState icon={CircleDot} title="Pelada não encontrada" />;

  return (
    <div className="space-y-4">
      <Link to="/peladas/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setModo("avaliacao")} className={`rounded-xl border py-3 text-sm font-bold ${modo === "avaliacao" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          ⭐ Por avaliação
        </button>
        <button onClick={() => setModo("pote")} className={`rounded-xl border py-3 text-sm font-bold ${modo === "pote" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          🎱 Por pote
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Sorteio — {pelada.nome_pelada}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {totalLinha} de linha + {totalGoleirosDisp} goleiro(s) confirmados · vai formar os <b>{numTimes} times</b> configurados,
          com {linhaComSobra > 0 ? `${linhaPorTimeAprox} ou ${linhaPorTimeAprox + 1}` : linhaPorTimeAprox} jogadores de linha em cada
        </p>
        {!minimoOk && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-yellow-500/10 p-3 text-xs text-yellow-500">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Mínimo de jogadores não atingido (precisa de pelo menos {pelada.numero_times * 2} de linha, pra dar pelo menos 2 por time).
          </div>
        )}
        {totalGoleirosConfirmados < totalGoleirosNecessarios && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-yellow-500/10 p-3 text-xs text-yellow-500">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Goleiros confirmados ({totalGoleirosConfirmados}) abaixo do ideal ({totalGoleirosNecessarios}). Você pode prosseguir mesmo assim, ou{" "}
              <Link to="/goleiros" className="font-bold underline">buscar um goleiro no catálogo</Link>.
            </span>
          </div>
        )}
        {numTimes === 3 && totalGoleirosDisp === 2 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-500/10 p-3 text-xs text-blue-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            3 times com 2 goleiros: o sistema já equilibra automaticamente, colocando o goleiro mais fraco no time de linha mais forte (e vice-versa) nos 2 times que começam jogando. O 3º time (que começa de fora) fica sem goleiro fixo por enquanto.
          </div>
        )}
      </div>

      {pendentes.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-bold">{pendentes.length} jogador(es) sem skills definidas</div>
            <div className="text-xs opacity-90">{pendentes.map((p: any) => p.nome).join(", ")}. Receberão média neutra 5.5 no sorteio.</div>
          </div>
        </div>
      )}

      {modo === "avaliacao" ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Confirmados</h3>
          <div className="grid gap-2">
            {confirmados.map((j) => (
              <div key={j.user_id} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{j.nome}{j.eh_goleiro ? " 🧤" : ""}</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${(j.media / 10) * 100}%` }} />
                </div>
                <span className="w-8 text-right text-xs font-bold text-primary">{j.media.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Separar em potes</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {numPotes} potes (1 por jogador de linha em cada time) · cada pote precisa ter exatamente <b>{numTimes}</b> jogador(es).
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={incluirGoleirosPote} onChange={(e) => { setIncluirGoleirosPote(e.target.checked); setPotes({}); }} className="h-4 w-4" />
            Incluir goleiros nos potes também (por padrão eles ficam de fora e são distribuídos separado)
          </label>

          <div className="flex flex-wrap gap-2">
            {Array.from({ length: numPotes }, (_, i) => i + 1).map((p) => (
              <span key={p} className={`rounded-full border px-3 py-1 text-xs font-bold ${contagemPorPote[p] === numTimes ? "border-green-500 text-green-500" : "border-yellow-500 text-yellow-500"}`}>
                Pote {p}: {contagemPorPote[p] || 0}/{numTimes}
              </span>
            ))}
          </div>

          <div className="space-y-2">
            {jogadoresParaPote.map((j) => (
              <div key={j.user_id} className="rounded-xl border border-border p-2.5">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-bold">{j.nome}{j.eh_goleiro ? " 🧤" : ""}</span>
                  {potes[j.user_id] && <span className="text-xs font-bold text-primary">Pote {potes[j.user_id]}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: numPotes }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPotes((prev) => ({ ...prev, [j.user_id]: p }))}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${potes[j.user_id] === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      Pote {p}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {goleirosForaDoPote.length > 0 && (
            <p className="text-xs text-muted-foreground">
              🧤 {goleirosForaDoPote.map((g) => g.nome).join(", ")} — fica(m) de fora dos potes, distribuído(s) automaticamente entre os times.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={gerar} disabled={modo === "pote" ? !potesCompletos : !minimoOk} className="flex-1 bg-primary text-primary-foreground font-bold hover:bg-primary/90">
          <Shuffle className="mr-2 h-4 w-4" />{times.length ? "Regerar" : "Gerar Sorteio"}
        </Button>
      </div>
      {modo === "pote" && !potesCompletos && (
        <p className="text-center text-xs text-yellow-500">
          {semPote.length > 0 ? `Falta colocar ${semPote.length} jogador(es) num pote.` : "Ajuste os potes até cada um ter exatamente a quantidade certa de jogadores."}
        </p>
      )}

      <AlertDialog open={confirmacaoOpen} onOpenChange={setConfirmacaoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar sorteio?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Você tem {totalLinha} jogador(es) de linha e {totalGoleirosDisp} goleiro(s) confirmado(s).</p>
                <p>
                  Isso vai formar os <b>{numTimes} times</b> configurados, com {linhaComSobra > 0 ? `${linhaPorTimeAprox} ou ${linhaPorTimeAprox + 1}` : linhaPorTimeAprox} jogadores de linha em cada
                  {totalGoleirosDisp > 0 && totalGoleirosDisp < numTimes
                    ? ", com os goleiros revezando entre os times (não tem um pra cada time ainda)."
                    : totalGoleirosDisp >= numTimes
                      ? ", com um goleiro fixo em cada time."
                      : "."}
                </p>
                {numTimes === 3 && totalGoleirosDisp === 2 && (
                  <p>O sistema vai equilibrar automaticamente colocando o goleiro mais fraco no time mais forte, e vice-versa, nos 2 times que começam jogando.</p>
                )}
                <p>Deseja sortear mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmacaoOpen(false); modo === "pote" ? gerarPorPoteInterno() : gerarInterno(); }}>Sortear</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {times.length > 0 && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {times.map((t, i) => {
              const todos = [...t.jogadores, ...t.goleiros];
              const forca = mediaTime(todos);
              return (
                <div key={i} className="rounded-2xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="h-6 w-6 rounded-full border border-border" style={{ background: t.cor }} />
                    <Input value={t.nome} onChange={(e) => setTimes((arr) => arr.map((x, idx) => idx === i ? { ...x, nome: e.target.value } : x))} className="h-8 flex-1 bg-secondary" />
                    <input type="color" value={t.cor} onChange={(e) => setTimes((arr) => arr.map((x, idx) => idx === i ? { ...x, cor: e.target.value } : x))} className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent" />
                  </div>
                  <div className="grid gap-1.5">
                    {todos.map((j) => (
                      <div key={j.user_id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{j.eh_goleiro ? "🧤 " : ""}{j.nome}</span>
                        <span className="text-xs text-primary">{j.media.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
                    Força do time: <span className="font-bold text-primary">{forca.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <Button onClick={confirmar} disabled={saving} className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90">
            Confirmar Sorteio
          </Button>
        </>
      )}
    </div>
  );
}
