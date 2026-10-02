import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcularTabela } from "@/lib/placar";
import { corTextoLegivel } from "@/lib/sorteio";
import { Logo } from "@/components/Logo";
import { Clock } from "lucide-react";

export const Route = createFileRoute("/placar/$arena/$quadra")({ component: TVPlacar });

const TIPO_ICON: Record<string, string> = { gol: "⚽", passe_decisivo: "🤝", defesa: "🧤", falta: "🟨", outro: "•" };

// Tempo que cada anunciante fica em tela antes de revezar pro próximo,
// quando a quadra tem mais de um cadastrado.
const INTERVALO_ANUNCIO_MS = 10_000;

function AnuncioTV({ anuncio }: { anuncio: { nome: string; imagem_url: string; link_url: string | null } }) {
  const img = <img src={anuncio.imagem_url} alt={anuncio.nome} className="h-20 w-full object-cover md:h-24" />;
  return (
    <div className="border-t border-border bg-card">
      {anuncio.link_url ? (
        <a href={anuncio.link_url} target="_blank" rel="noopener noreferrer" className="block">{img}</a>
      ) : img}
    </div>
  );
}

function TVPlacar() {
  const { arena, quadra } = Route.useParams();
  const [pelada, setPelada] = useState<any>(null);
  const [times, setTimes] = useState<any[]>([]);
  const [partidas, setPartidas] = useState<any[]>([]);
  const [lances, setLances] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [now, setNow] = useState(Date.now());
  const [quadraNome, setQuadraNome] = useState<string>("");
  const [anuncios, setAnuncios] = useState<any[]>([]);
  const [anuncioIdx, setAnuncioIdx] = useState(0);

  const load = async () => {
    const { data: q } = await supabase.from("quadras_publicas").select("*").eq("slug_arena", arena).eq("slug_quadra", quadra).maybeSingle();
    if (!q) { setPelada(null); return; }
    setQuadraNome(q.nome);
    // Anúncios são da quadra do DONO (tabela "quadras"), não da quadra
    // pública em si — por isso o passo extra de achar o id dela a partir do
    // vínculo quadra_publica_id. Carrega independente de ter pelada rolando
    // ou não, pra a TV também anunciar enquanto está "aguardando".
    const { data: qDono } = await supabase.from("quadras").select("id").eq("quadra_publica_id", q.id).maybeSingle();
    if (qDono) {
      const { data: vinc } = await supabase.from("tv_anunciante_quadras").select("tv_anunciantes(id,nome,imagem_url,link_url,ativo)").eq("quadra_id", qDono.id);
      const ativos = ((vinc ?? []) as any[]).map((v) => v.tv_anunciantes).filter((a: any) => a?.ativo);
      setAnuncios(ativos);
    }
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

  // Revezia entre os anunciantes ativos dessa quadra, quando há mais de um.
  useEffect(() => {
    if (anuncios.length <= 1) return;
    const t = setInterval(() => setAnuncioIdx((i) => (i + 1) % anuncios.length), INTERVALO_ANUNCIO_MS);
    return () => clearInterval(t);
  }, [anuncios.length]);

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
  const recorde = (tid: string) => tabela[tid] || { v: 0, e: 0, d: 0 };

  const anuncioAtual = anuncios.length > 0 ? anuncios[anuncioIdx % anuncios.length] : null;

  if (!pelada || !atual) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <Logo />
          <p className="mt-6 animate-pulse text-2xl text-muted-foreground">Aguardando próxima pelada...</p>
          {quadraNome && <p className="mt-2 text-sm text-muted-foreground">{quadraNome}</p>}
        </div>
        {anuncioAtual && <AnuncioTV anuncio={anuncioAtual} />}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border p-4">
        <Logo />
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Início <span className="font-bold text-foreground">{pelada.horario_inicio?.slice(0, 5)}</span></span>
          <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Fim <span className="font-bold text-foreground">{pelada.horario_fim?.slice(0, 5)}</span></span>
        </div>
      </div>

      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-8">
          <div className="grid w-full grid-cols-3 items-start gap-6">
            {(() => {
              const r = recorde(atual.time_a_id);
              return (
                <div className="flex flex-col items-center rounded-2xl p-6" style={{ background: `${corTime(atual.time_a_id)}22`, borderTop: `8px solid ${corTime(atual.time_a_id)}` }}>
                  <div className="text-3xl font-black">{nomeTime(atual.time_a_id)}</div>
                  <div className="mt-4 text-9xl font-black text-primary">{atual.placar_a}</div>
                  <div className="mt-6 grid w-full grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center">
                    <div><div className="text-xl font-black text-emerald-500">{r.v}</div><div className="text-[10px] uppercase text-muted-foreground">Vitórias</div></div>
                    <div><div className="text-xl font-black text-foreground">{r.e}</div><div className="text-[10px] uppercase text-muted-foreground">Empates</div></div>
                    <div><div className="text-xl font-black text-rose-500">{r.d}</div><div className="text-[10px] uppercase text-muted-foreground">Derrotas</div></div>
                  </div>
                </div>
              );
            })()}
            <div className="text-center">
              <div className="text-sm uppercase text-muted-foreground">Partida {atual.numero_partida}</div>
              <div className={`mt-2 text-7xl font-black tabular-nums ${restanteSec <= 120 ? "text-red-500" : "text-foreground"}`}>{fmt(restanteSec)}</div>
              <div className="mt-4 text-2xl text-muted-foreground">vs</div>
              {atual.time_fora_id && (
                <div className="mt-6 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">Próximo jogo</span>
                  <div className="font-bold">{nomeTime(atual.time_fora_id)}</div>
                </div>
              )}
            </div>
            {(() => {
              const r = recorde(atual.time_b_id);
              return (
                <div className="flex flex-col items-center rounded-2xl p-6" style={{ background: `${corTime(atual.time_b_id)}22`, borderTop: `8px solid ${corTime(atual.time_b_id)}` }}>
                  <div className="text-3xl font-black">{nomeTime(atual.time_b_id)}</div>
                  <div className="mt-4 text-9xl font-black text-primary">{atual.placar_b}</div>
                  <div className="mt-6 grid w-full grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center">
                    <div><div className="text-xl font-black text-emerald-500">{r.v}</div><div className="text-[10px] uppercase text-muted-foreground">Vitórias</div></div>
                    <div><div className="text-xl font-black text-foreground">{r.e}</div><div className="text-[10px] uppercase text-muted-foreground">Empates</div></div>
                    <div><div className="text-xl font-black text-rose-500">{r.d}</div><div className="text-[10px] uppercase text-muted-foreground">Derrotas</div></div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Últimos lances</h3>
              <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-500">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />AO VIVO
              </span>
            </div>
            {lances.length === 0 ? <p className="text-sm text-muted-foreground">Sem lances.</p> : (
              <div className="grid gap-1.5">
                {lances.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 rounded bg-secondary/40 px-2 py-1.5 text-sm">
                    <span className="text-xl">{TIPO_ICON[l.tipo]}</span>
                    <span className="flex-1 font-bold">{profiles[l.user_id]?.nome || "—"}</span>
                    <span className="text-xs" style={{ color: corTextoLegivel(corTime(l.time_id)) }}>{nomeTime(l.time_id)}</span>
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

      {anuncioAtual && <AnuncioTV anuncio={anuncioAtual} />}
    </div>
  );
}
