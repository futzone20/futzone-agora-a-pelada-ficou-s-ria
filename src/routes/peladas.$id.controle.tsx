import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { MobileShell } from "@/components/MobileShell";
import { ArrowLeft, Play, Pause, Square, Copy, Tv, Home, Users, Trophy, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { slugify, calcularTabela } from "@/lib/placar";
import { notificarVencedoresPelada } from "@/lib/notificarVencedores";

export const Route = createFileRoute("/peladas/$id/controle")({ component: Wrapper });

const items = [
  { to: "/capitao", label: "Início", icon: Home },
  { to: "/capitao/grupos", label: "Grupos", icon: Users },
  { to: "/capitao/ranking", label: "Ranking", icon: Trophy },
  { to: "/capitao/perfil", label: "Perfil", icon: User },
];

function Wrapper() {
  return (
    <RequireAuth allow={["capitao", "admin"]}>
      <MobileShell items={items as any}><Controle /></MobileShell>
    </RequireAuth>
  );
}

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.stop(ctx.currentTime + 0.4);
  } catch {}
}

function Controle() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pelada, setPelada] = useState<any>(null);
  const [quadra, setQuadra] = useState<any>(null);
  const [times, setTimes] = useState<any[]>([]);
  const [timeJogadores, setTimeJogadores] = useState<any[]>([]);
  const [partidas, setPartidas] = useState<any[]>([]);
  const [auxiliares, setAuxiliares] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const beepedRef = useRef<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data: p } = await supabase.from("peladas").select("*").eq("id", id).maybeSingle();
    setPelada(p);
    if (p?.quadra_id) {
      const { data: q } = await supabase.from("quadras_publicas").select("*").eq("id", p.quadra_id).maybeSingle();
      if (q && (!q.slug_arena || !q.slug_quadra)) {
        const sa = slugify(q.nome || "arena");
        const sq = slugify(q.nome || "quadra");
        await supabase.from("quadras_publicas").update({ slug_arena: sa, slug_quadra: sq } as never).eq("id", q.id);
        q.slug_arena = sa; q.slug_quadra = sq;
      }
      setQuadra(q);
    }
    const { data: ts } = await supabase.from("times").select("*").eq("pelada_id", id).order("ordem");
    setTimes(ts || []);
    const { data: tj } = await supabase.from("time_jogadores").select("*").eq("pelada_id", id);
    setTimeJogadores(tj || []);
    const { data: prs } = await supabase.from("partidas").select("*").eq("pelada_id", id).order("numero_partida");
    setPartidas(prs || []);
    const { data: aux } = await supabase.from("auxiliares_partida").select("*").eq("pelada_id", id);
    setAuxiliares(aux || []);
    const uids = Array.from(new Set([...(tj || []).map((x: any) => x.user_id), ...(aux || []).map((x: any) => x.user_id)]));
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", uids);
      const m: Record<string, any> = {};
      (profs || []).forEach((x: any) => { m[x.user_id] = x; });
      setProfiles(m);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, [id]);

  useEffect(() => {
    const ch = supabase.channel(`controle-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "partidas", filter: `pelada_id=eq.${id}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const atual = useMemo(() => partidas.find((p) => p.status === "em_andamento") || partidas.find((p) => p.status === "aguardando"), [partidas]);

  const restanteSec = (p: any) => {
    if (!p?.iniciada_em || p.status !== "em_andamento") return p ? p.duracao_minutos * 60 : 0;
    const ini = new Date(p.iniciada_em).getTime();
    return Math.max(0, p.duracao_minutos * 60 - Math.floor((now - ini) / 1000));
  };
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (atual?.status === "em_andamento" && restanteSec(atual) === 0 && !beepedRef.current.has(atual.id)) {
      beepedRef.current.add(atual.id);
      beep();
    }
  }, [now, atual]);

  const definirAuxiliarSeNecessario = async (partida: any) => {
    if (!partida.time_fora_id) return;
    const existe = auxiliares.find((a) => a.partida_id === partida.id);
    if (existe) return;
    const jogadoresFora = timeJogadores.filter((x) => x.time_id === partida.time_fora_id);
    if (!jogadoresFora.length) return;
    const escolhido = jogadoresFora[Math.floor(Math.random() * jogadoresFora.length)];
    await supabase.from("auxiliares_partida").insert({
      partida_id: partida.id, pelada_id: id, user_id: escolhido.user_id, time_fora_id: partida.time_fora_id,
    } as never);
    await supabase.from("notificacoes").insert({
      user_id: escolhido.user_id, titulo: "Você é o auxiliar!",
      mensagem: "Você é o auxiliar da próxima partida! Prepare-se.",
      link: `/peladas/${id}/lances`,
    } as never);
  };

  const iniciarPelada = async () => {
    if (!user) return;
    if (!times.length || times.length < 2) return toast.error("Faça o sorteio primeiro");
    await supabase.from("peladas").update({ status: "em_andamento" } as never).eq("id", id);
    await supabase.from("placar_sessao").insert({ pelada_id: id, ativa: true } as never);
    if (partidas.length === 0) {
      const tabela = calcularTabela([], times);
      const ordenados = pelada.sistema_disputa === "rodizio"
        ? [...times].sort((a, b) => 0) // ordem original; fora = maior força
        : [...times];
      // time fora = maior força inicial; pra simplificar usamos ordem definida no sorteio
      const fora = ordenados.length >= 3 ? ordenados[0] : null;
      const restantes = ordenados.filter((t) => t.id !== fora?.id);
      const [a, b] = [restantes[0], restantes[1] || ordenados[1]];
      const { data: nova } = await supabase.from("partidas").insert({
        pelada_id: id, numero_partida: 1, time_a_id: a.id, time_b_id: b.id, time_fora_id: fora?.id || null,
        duracao_minutos: pelada.duracao_partida_minutos,
      } as never).select().single();
      if (nova) await definirAuxiliarSeNecessario(nova);
    }
    void load();
  };

  const iniciarCronometro = async (p: any) => {
    await supabase.from("partidas").update({ iniciada_em: new Date().toISOString(), status: "em_andamento" } as never).eq("id", p.id);
    beepedRef.current.delete(p.id);
    void load();
  };

  const encerrarPartida = async (p: any) => {
    await supabase.from("partidas").update({ status: "encerrada", encerrada_em: new Date().toISOString() } as never).eq("id", p.id);
    // próxima partida (rodízio): vencedor + time fora, perdedor sai
    if (pelada.sistema_disputa === "rodizio" && p.time_fora_id) {
      const vencedor = p.placar_a > p.placar_b ? p.time_a_id : p.placar_b > p.placar_a ? p.time_b_id : null;
      const perdedor = vencedor === p.time_a_id ? p.time_b_id : vencedor === p.time_b_id ? p.time_a_id : p.time_b_id;
      const novoA = vencedor || p.time_a_id;
      const novoB = p.time_fora_id;
      const novoFora = perdedor;
      const { data: nova } = await supabase.from("partidas").insert({
        pelada_id: id, numero_partida: p.numero_partida + 1,
        time_a_id: novoA, time_b_id: novoB, time_fora_id: novoFora,
        duracao_minutos: pelada.duracao_partida_minutos,
      } as never).select().single();
      if (nova) await definirAuxiliarSeNecessario(nova);
    }
    void load();
  };

  const encerrarPelada = async () => {
    if (!confirm("Encerrar pelada?")) return;
    await supabase.from("peladas").update({ status: "encerrada" } as never).eq("id", id);
    await supabase.from("placar_sessao").update({ ativa: false, encerrada_em: new Date().toISOString() } as never).eq("pelada_id", id);
    void notificarVencedoresPelada(id);
    toast.success("Pelada encerrada");
    navigate({ to: "/capitao" });
  };

  if (loading) return <div className="text-sm text-muted-foreground">Carregando...</div>;
  if (!pelada) return <div>Pelada não encontrada</div>;

  const linkTV = quadra?.slug_arena ? `${typeof window !== "undefined" ? window.location.origin : ""}/placar/${quadra.slug_arena}/${quadra.slug_quadra}` : "";
  const tabela = calcularTabela(partidas, times);
  const tabelaOrd = Object.values(tabela).sort((a, b) => b.pts - a.pts || (b.gp - b.gc) - (a.gp - a.gc));
  const auxAtual = atual ? auxiliares.find((a) => a.partida_id === atual.id) : null;
  const nomeTime = (tid: string) => times.find((t) => t.id === tid)?.nome || "—";

  return (
    <div className="space-y-4">
      <Link to="/peladas/$id" params={{ id }} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">{pelada.nome_pelada}</h2>
        <p className="text-sm text-muted-foreground">{quadra?.nome || "—"} · {pelada.data.split("-").reverse().join("/")}</p>
        <p className="mt-1 text-xs">Status: <span className="font-bold text-primary">{pelada.status}</span></p>
        <div className="mt-3 flex flex-wrap gap-2">
          {pelada.status !== "em_andamento" && pelada.status !== "encerrada" && (
            <Button onClick={iniciarPelada} className="bg-primary text-primary-foreground font-bold">
              <Play className="mr-2 h-4 w-4" /> Iniciar Pelada
            </Button>
          )}
          {linkTV && (
            <>
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(linkTV); toast.success("Link copiado"); }}>
                <Copy className="mr-2 h-4 w-4" /> Copiar link da TV
              </Button>
              <Button asChild variant="outline">
                <a href={linkTV} target="_blank" rel="noreferrer"><Tv className="mr-2 h-4 w-4" /> Abrir TV</a>
              </Button>
            </>
          )}
          {pelada.status !== "encerrada" && (
            <Button variant="destructive" onClick={encerrarPelada}><Square className="mr-2 h-4 w-4" /> Encerrar Pelada</Button>
          )}
        </div>
      </div>

      {atual && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Partida {atual.numero_partida}</h3>
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 text-center">
              <div className="text-xs text-muted-foreground">{nomeTime(atual.time_a_id)}</div>
              <div className="text-5xl font-black text-primary">{atual.placar_a}</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-black tabular-nums ${restanteSec(atual) <= 120 ? "text-red-500" : ""}`}>{fmt(restanteSec(atual))}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-xs text-muted-foreground">{nomeTime(atual.time_b_id)}</div>
              <div className="text-5xl font-black text-primary">{atual.placar_b}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {atual.status === "aguardando" && (
              <Button onClick={() => iniciarCronometro(atual)} className="bg-primary text-primary-foreground"><Play className="mr-2 h-4 w-4" />Iniciar Cronômetro</Button>
            )}
            <Button variant="destructive" onClick={() => encerrarPartida(atual)}><Square className="mr-2 h-4 w-4" />Encerrar Partida</Button>
          </div>
          {auxAtual && (
            <p className="mt-3 text-xs text-muted-foreground">Auxiliar: <span className="font-bold text-foreground">{profiles[auxAtual.user_id]?.nome || "—"}</span></p>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Quadro Geral</h3>
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="text-left">Time</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>Pts</th></tr>
          </thead>
          <tbody>
            {tabelaOrd.map((r) => (
              <tr key={r.time_id} className="border-t border-border">
                <td className="py-2"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: r.cor }} />{r.nome}</td>
                <td className="text-center">{r.v}</td><td className="text-center">{r.e}</td><td className="text-center">{r.d}</td>
                <td className="text-center">{r.gp}</td><td className="text-center">{r.gc}</td><td className="text-center font-bold text-primary">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Histórico</h3>
        {partidas.filter((p) => p.status === "encerrada").length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma partida encerrada ainda.</p>
        ) : (
          <div className="grid gap-1 text-sm">
            {partidas.filter((p) => p.status === "encerrada").map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded bg-secondary/40 px-3 py-2">
                <span>#{p.numero_partida} {nomeTime(p.time_a_id)} vs {nomeTime(p.time_b_id)}</span>
                <span className="font-bold">{p.placar_a} x {p.placar_b}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
