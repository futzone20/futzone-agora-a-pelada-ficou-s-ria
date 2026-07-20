import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcularTabela } from "@/lib/placar";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/placar/$arena/$quadra")({ component: TVPlacar });

const TIPO_ICON: Record<string, string> = { gol: "⚽", passe_decisivo: "🤝", defesa: "🧤", falta: "🟨", outro: "•" };

function TVPlacar() {
  const { arena, quadra } = Route.useParams();
  const [pelada, setPelada] = useState<any>(null);
  const [times, setTimes] = useState<any[]>([]);
  const [partidas, setPartidas] = useState<any[]>([]);
  const [lances, setLances] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [now, setNow] = useState(Date.now());
  const [quadraNome, setQuadraNome] = useState<string>("");

  const load = async () => {
    const { data: q } = await supabase.from("quadras_publicas").select("*").eq("slug_arena", arena).eq("slug_quadra", quadra).maybeSingle();
    if (!q) { setPelada(null); return; }
    setQuadraNome(q.nome);
    const { data: ps } = await supabase.from("peladas").select("*").eq("quadra_id", q.id).in("status", ["confirmada", "em_andamento"]).order("data", { ascending: false }).limit(1);
    const p = ps?.[0];
    setPelada(p || null);
    if (!p) { setTimes([]); setPartidas([]); setLances([]); return; }
    const [{ data: ts }, { data: prs }] = await Promise.all([
      supabase.from("times").select("*").eq("pelada_id", p.id).order("ordem"),
      supabase.from("partidas").select("*").eq("pelada_id", p.id).order("numero_partida"),
    ]);
    setTimes(ts || []);
    setPartidas(prs || []);
    const atual = (prs || []).find((x: any) => x.status === "em_andamento") || (prs || []).slice(-1)[0];
    if (atual) {
      const { data: ls } = await supabase.from("lances").select("*").eq("partida_id", atual.id).order("criado_em", { ascending: false }).limit(5);
      setLances(ls || []);
      const uids = (ls || []).map((x: any) => x.user_id);
      if (uids.length) {
        const { data: profs } = await supabase.from("profiles").select("user_id, nome").in("user_id", uids);
        const m: Record<string, any> = {};
        (profs || []).forEach((x: any) => { m[x.user_id] = x; });
        setProfiles(m);
      }
    }
  };

  useEffect(() => { void load(); }, [arena, quadra]);

  useEffect(() => {
    if (!pelada) return;
    const ch = supabase.channel(`tv-${pelada.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "partidas", filter: `pelada_id=eq.${pelada.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "lances", filter: `pelada_id=eq.${pelada.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "peladas", filter: `id=eq.${pelada.id}` }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pelada?.id]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);

  const atual = useMemo(() => partidas.find((p) => p.status === "em_andamento") || partidas.slice(-1)[0], [partidas]);
  const proxima = useMemo(() => partidas.find((p) => p.status === "aguardando" && (!atual || p.id !== atual.id)), [partidas, atual]);
  const restanteSec = useMemo(() => {
    if (!atual?.iniciada_em || atual.status !== "em_andamento") return atual ? atual.duracao_minutos * 60 : 0;
    const ini = new Date(atual.iniciada_em).getTime();
    return Math.max(0, atual.duracao_minutos * 60 - Math.floor((now - ini) / 1000));
  }, [atual, now]);
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const tabela = calcularTabela(partidas, times);
  const tabelaOrd = Object.values(tabela).sort((a, b) => b.pts - a.pts);
  const nomeTime = (tid: string) => times.find((t) => t.id === tid)?.nome || "—";
  const corTime = (tid: string) => times.find((t) => t.id === tid)?.cor || "#666";

  if (!pelada || !atual) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-foreground">
        <Logo />
        <p className="mt-6 animate-pulse text-2xl text-muted-foreground">Aguardando próxima pelada...</p>
        {quadraNome && <p className="mt-2 text-sm text-muted-foreground">{quadraNome}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border p-4">
        <Logo />
        <div className="text-right text-sm text-muted-foreground">{quadraNome} · {pelada.nome_pelada}</div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-8">
          <div className="grid w-full grid-cols-3 items-center gap-6">
            <div className="flex flex-col items-center rounded-2xl p-6" style={{ background: `${corTime(atual.time_a_id)}22`, borderTop: `8px solid ${corTime(atual.time_a_id)}` }}>
              <div className="text-3xl font-black">{nomeTime(atual.time_a_id)}</div>
              <div className="mt-4 text-9xl font-black text-primary">{atual.placar_a}</div>
            </div>
            <div className="text-center">
              <div className="text-sm uppercase text-muted-foreground">Partida {atual.numero_partida}</div>
              <div className={`mt-2 text-7xl font-black tabular-nums ${restanteSec <= 120 ? "text-red-500" : "text-foreground"}`}>{fmt(restanteSec)}</div>
              <div className="mt-4 text-2xl text-muted-foreground">vs</div>
            </div>
            <div className="flex flex-col items-center rounded-2xl p-6" style={{ background: `${corTime(atual.time_b_id)}22`, borderTop: `8px solid ${corTime(atual.time_b_id)}` }}>
              <div className="text-3xl font-black">{nomeTime(atual.time_b_id)}</div>
              <div className="mt-4 text-9xl font-black text-primary">{atual.placar_b}</div>
            </div>
          </div>
          {atual.time_fora_id && (
            <p className="mt-6 text-sm text-muted-foreground">Próximo: <span className="font-bold text-foreground">{nomeTime(atual.time_fora_id)}</span></p>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Últimos lances</h3>
            {lances.length === 0 ? <p className="text-sm text-muted-foreground">Sem lances.</p> : (
              <div className="grid gap-1.5">
                {lances.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 rounded bg-secondary/40 px-2 py-1.5 text-sm">
                    <span className="text-xl">{TIPO_ICON[l.tipo]}</span>
                    <span className="flex-1 font-bold">{profiles[l.user_id]?.nome || "—"}</span>
                    <span className="text-xs" style={{ color: corTime(l.time_id) }}>{nomeTime(l.time_id)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Quadro Geral</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="text-left">Time</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>Pts</th></tr></thead>
              <tbody>
                {tabelaOrd.map((r) => (
                  <tr key={r.time_id} className="border-t border-border">
                    <td className="py-1.5"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: r.cor }} />{r.nome}</td>
                    <td className="text-center">{r.v}</td><td className="text-center">{r.e}</td><td className="text-center">{r.d}</td>
                    <td className="text-center">{r.gp}</td><td className="text-center">{r.gc}</td><td className="text-center font-bold text-primary">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {proxima && (
            <div className="rounded-2xl border border-border bg-card p-4 text-sm">
              Próxima: <span className="font-bold">{nomeTime(proxima.time_a_id)} vs {nomeTime(proxima.time_b_id)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
